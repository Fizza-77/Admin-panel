import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { formatDbError, isMissingTableError, EMPLOYEE_SOFTWARE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { isBillingCycle, type BillingCycle } from '@/lib/expenses/software';
import { parseIncomingAmountPkr } from '@/lib/expenses/currency';
import {
  deleteExpensesForSoftware,
  syncSoftwareExpenseAfterSoftwareChange,
} from '@/lib/expenses/softwareExpenseLink';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const softwareId = req.query.softwareId;
  if (typeof softwareId !== 'string') {
    return res.status(400).json({ message: 'Invalid software id' });
  }

  if (req.method === 'PATCH') {
    const body = req.body ?? {};
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.software_name !== undefined) {
      const software_name = typeof body.software_name === 'string' ? body.software_name.trim().slice(0, 120) : '';
      if (!software_name) {
        return res.status(400).json({ message: 'software_name cannot be empty' });
      }
      updates.software_name = software_name;
    }

    if (body.billing_cycle !== undefined) {
      if (!isBillingCycle(body.billing_cycle)) {
        return res.status(400).json({ message: 'Invalid billing_cycle' });
      }
      updates.billing_cycle = body.billing_cycle as BillingCycle;
    }

    if (body.monthly_amount !== undefined) {
      if (body.monthly_amount === null || body.monthly_amount === '') {
        updates.monthly_amount = null;
      } else {
        const amountResult = parseIncomingAmountPkr(body, { allowZero: true });
        if ('error' in amountResult) {
          return res.status(400).json({ message: amountResult.error });
        }
        updates.monthly_amount = amountResult.pkr;
      }
    }

    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
    }

    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active);
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('employee_software')
      .update(updates)
      .eq('id', softwareId)
      .select('id')
      .maybeSingle();

    if (error) {
      reportError(error, { source: 'api/expenses/software PATCH', softwareId });
      if (isMissingTableError(error, 'employee_software')) {
        return res.status(503).json({ message: EMPLOYEE_SOFTWARE_SETUP_HINT });
      }
      if (/duplicate|unique/i.test(error.message ?? '')) {
        return res.status(409).json({ message: 'This employee already has that software listed' });
      }
      return res.status(500).json({ message: formatDbError(error) });
    }

    if (!data) {
      return res.status(404).json({ message: 'Software record not found' });
    }

    await syncSoftwareExpenseAfterSoftwareChange(auth.userId);
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    await deleteExpensesForSoftware(softwareId);

    const { data, error } = await supabase
      .from('employee_software')
      .delete()
      .eq('id', softwareId)
      .select('id')
      .maybeSingle();

    if (error) {
      reportError(error, { source: 'api/expenses/software DELETE', softwareId });
      if (isMissingTableError(error, 'employee_software')) {
        return res.status(503).json({ message: EMPLOYEE_SOFTWARE_SETUP_HINT });
      }
      return res.status(500).json({ message: formatDbError(error) });
    }

    if (!data) {
      return res.status(404).json({ message: 'Software record not found' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
