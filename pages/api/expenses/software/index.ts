import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRowsByUserIds } from '@/lib/permissions/appProfileDb';
import { formatDbError, isMissingTableError, EMPLOYEE_SOFTWARE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { listTeamUsersForExpenses } from '@/lib/expenses/listTeamUsers';
import {
  groupSoftwareByEmployee,
  isBillingCycle,
  type BillingCycle,
  type EmployeeSoftwareItem,
} from '@/lib/expenses/software';
import { parseNonNegativeAmountInput } from '@/lib/expenses/types';

function mapRow(row: Record<string, unknown>): EmployeeSoftwareItem | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const user_id = typeof row.user_id === 'string' ? row.user_id : null;
  const software_name = typeof row.software_name === 'string' ? row.software_name.trim() : '';
  const billing_cycle = row.billing_cycle;
  const created_by = typeof row.created_by === 'string' ? row.created_by : null;
  const created_at = typeof row.created_at === 'string' ? row.created_at : null;
  const updated_at = typeof row.updated_at === 'string' ? row.updated_at : null;

  if (!id || !user_id || !software_name || !isBillingCycle(billing_cycle) || !created_by || !created_at || !updated_at) {
    return null;
  }

  const monthly_amount =
    row.monthly_amount != null && Number.isFinite(Number(row.monthly_amount)) ? Number(row.monthly_amount) : null;

  return {
    id,
    user_id,
    software_name,
    monthly_amount,
    billing_cycle,
    notes: typeof row.notes === 'string' ? row.notes.trim() || null : null,
    is_active: row.is_active !== false,
    created_by,
    created_at,
    updated_at,
    employee_name: null,
    employee_surname: null,
    employee_email: null,
  };
}

async function enrichItems(items: EmployeeSoftwareItem[]): Promise<EmployeeSoftwareItem[]> {
  if (items.length === 0) {
    return items;
  }

  const userIds = Array.from(new Set(items.map((i) => i.user_id)));
  const profiles = await fetchAppProfileRowsByUserIds(userIds);
  const emailById = new Map<string, string | null>();

  await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        reportError(error, { source: 'api/expenses/software enrich', userId });
        emailById.set(userId, null);
        return;
      }
      emailById.set(userId, data.user?.email ?? null);
    }),
  );

  return items.map((item) => {
    const profile = profiles.byUserId.get(item.user_id);
    return {
      ...item,
      employee_name: profile?.display_name ?? null,
      employee_surname: profile?.surname ?? null,
      employee_email: emailById.get(item.user_id) ?? null,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method === 'GET') {
    const activeOnly = req.query.active !== 'false';

    let query = supabase
      .from('employee_software')
      .select(
        'id, user_id, software_name, monthly_amount, billing_cycle, notes, is_active, created_by, created_at, updated_at',
      )
      .order('software_name', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const [{ data, error }, team] = await Promise.all([query, listTeamUsersForExpenses()]);

    if (error) {
      reportError(error, { source: 'api/expenses/software GET' });
      if (isMissingTableError(error, 'employee_software')) {
        return res.status(503).json({ message: EMPLOYEE_SOFTWARE_SETUP_HINT, code: 'employee_software_not_migrated' });
      }
      return res.status(500).json({ message: 'Failed to load software', detail: formatDbError(error) });
    }

    const items = (data ?? [])
      .map((row) => mapRow(row as Record<string, unknown>))
      .filter((row): row is EmployeeSoftwareItem => row !== null);

    const enriched = await enrichItems(items);
    const groups = groupSoftwareByEmployee(enriched);
    const monthly_total = groups.reduce((sum, g) => sum + g.monthly_total, 0);

    return res.status(200).json({
      items: enriched,
      groups,
      monthly_total,
      team_users: team.users,
    });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const software_name = typeof body.software_name === 'string' ? body.software_name.trim().slice(0, 120) : '';
    const billing_cycle: BillingCycle = isBillingCycle(body.billing_cycle) ? body.billing_cycle : 'monthly';
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
    const is_active = body.is_active !== false;

    let monthly_amount: number | null = null;
    if (body.monthly_amount !== undefined && body.monthly_amount !== null && body.monthly_amount !== '') {
      monthly_amount = parseNonNegativeAmountInput(String(body.monthly_amount));
      if (monthly_amount === null) {
        return res.status(400).json({ message: 'Amount must be a non-negative number' });
      }
    }

    if (!user_id) {
      return res.status(400).json({ message: 'user_id is required' });
    }
    if (!software_name) {
      return res.status(400).json({ message: 'software_name is required' });
    }

    const { data: targetUser, error: userErr } = await supabase.auth.admin.getUserById(user_id);
    if (userErr || !targetUser?.user) {
      return res.status(400).json({ message: 'Invalid employee' });
    }

    const { data, error } = await supabase
      .from('employee_software')
      .insert({
        user_id,
        software_name,
        monthly_amount,
        billing_cycle,
        notes,
        is_active,
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .select(
        'id, user_id, software_name, monthly_amount, billing_cycle, notes, is_active, created_by, created_at, updated_at',
      )
      .single();

    if (error) {
      reportError(error, { source: 'api/expenses/software POST', userId: auth.userId });
      if (isMissingTableError(error, 'employee_software')) {
        return res.status(503).json({ message: EMPLOYEE_SOFTWARE_SETUP_HINT, code: 'employee_software_not_migrated' });
      }
      if (/duplicate|unique/i.test(error.message ?? '')) {
        return res.status(409).json({ message: 'This employee already has that software listed' });
      }
      return res.status(500).json({ message: 'Failed to add software', detail: formatDbError(error) });
    }

    const mapped = mapRow(data as Record<string, unknown>);
    if (!mapped) {
      return res.status(500).json({ message: 'Created row could not be read' });
    }
    const [enriched] = await enrichItems([mapped]);
    return res.status(201).json({ item: enriched });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
