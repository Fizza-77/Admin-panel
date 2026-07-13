import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRowsByUserIds } from '@/lib/permissions/appProfileDb';
import { formatDbError, isMissingColumnError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { parseIncomingAmountPkr } from '@/lib/expenses/currency';
import { resolveAssigneeId, stripAssigneeFromNotes, notesWithAssignee } from '@/lib/expenses/assigneeStorage';
import { listTeamUsersForExpenses } from '@/lib/expenses/listTeamUsers';
import {
  EXPENSE_BASE_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  expenseMonthFromDate,
  syncSoftwareExpenseAfterSoftwareChange,
  syncSoftwareExpensesForMonth,
  upsertSoftwareFromExpense,
} from '@/lib/expenses/softwareExpenseLink';
import {
  categoryNeedsEmployee,
  monthDateRange,
  monthInputValue,
  type ExpenseListItem,
} from '@/lib/expenses/types';

function mapExpenseRow(row: Record<string, unknown>): ExpenseListItem | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const expense_date = row.expense_date != null ? String(row.expense_date).slice(0, 10) : null;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const amount = row.amount != null ? Number(row.amount) : NaN;
  const created_by = typeof row.created_by === 'string' ? row.created_by : null;
  const created_at = typeof row.created_at === 'string' ? row.created_at : null;
  const updated_at = typeof row.updated_at === 'string' ? row.updated_at : null;
  const rawNotes = typeof row.notes === 'string' ? row.notes.trim() || null : null;
  const assigned_user_id =
    typeof row.assigned_user_id === 'string' ? row.assigned_user_id : resolveAssigneeId(null, rawNotes);
  const employee_software_id = typeof row.employee_software_id === 'string' ? row.employee_software_id : null;

  if (!id || !expense_date || !title || !Number.isFinite(amount) || amount <= 0 || !created_by || !created_at || !updated_at) {
    return null;
  }

  return {
    id,
    expense_date,
    title,
    amount,
    category: typeof row.category === 'string' ? row.category.trim() || null : null,
    notes: stripAssigneeFromNotes(rawNotes),
    created_by,
    assigned_user_id,
    employee_software_id,
    created_at,
    updated_at,
    created_by_name: null,
    created_by_email: null,
    assigned_user_name: null,
    assigned_user_surname: null,
    assigned_user_email: null,
  };
}

async function enrichExpenses(
  expenses: ExpenseListItem[],
  teamUsers: Awaited<ReturnType<typeof listTeamUsersForExpenses>>['users'],
): Promise<ExpenseListItem[]> {
  if (expenses.length === 0) {
    return expenses;
  }

  const { data: softwareRows } = await supabase
    .from('employee_software')
    .select('id, user_id, software_name, monthly_amount, billing_cycle')
    .eq('is_active', true);

  const softwareUserById = new Map<string, string>();
  for (const row of softwareRows ?? []) {
    if (typeof row.id === 'string' && typeof row.user_id === 'string') {
      softwareUserById.set(row.id, row.user_id);
    }
  }

  const withAssignees = expenses.map((expense) => {
    if (expense.assigned_user_id) {
      return expense;
    }

    if (expense.employee_software_id) {
      const userId = softwareUserById.get(expense.employee_software_id);
      if (userId) {
        return { ...expense, assigned_user_id: userId };
      }
    }

    return expense;
  });

  const userIds = Array.from(
    new Set(withAssignees.flatMap((e) => [e.created_by, e.assigned_user_id].filter((id): id is string => Boolean(id)))),
  );
  const profiles = await fetchAppProfileRowsByUserIds(userIds);
  const emailById = new Map<string, string | null>();
  const teamById = new Map(teamUsers.map((user) => [user.id, user]));

  await Promise.all(
    userIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        reportError(error, { source: 'api/expenses enrich', userId });
        emailById.set(userId, null);
        return;
      }
      emailById.set(userId, data.user?.email ?? null);
    }),
  );

  return withAssignees.map((expense) => {
    const creatorProfile = profiles.byUserId.get(expense.created_by);
    const assigneeProfile = expense.assigned_user_id ? profiles.byUserId.get(expense.assigned_user_id) : null;
    const teamUser = expense.assigned_user_id ? teamById.get(expense.assigned_user_id) : null;
    return {
      ...expense,
      created_by_name: creatorProfile?.display_name ?? null,
      created_by_email: emailById.get(expense.created_by) ?? null,
      assigned_user_name: assigneeProfile?.display_name ?? teamUser?.display_name ?? null,
      assigned_user_surname: assigneeProfile?.surname ?? teamUser?.surname ?? null,
      assigned_user_email:
        expense.assigned_user_id
          ? emailById.get(expense.assigned_user_id) ?? teamUser?.email ?? null
          : null,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method === 'GET') {
    const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : monthInputValue();
    const range = monthDateRange(rawMonth);
    if (!range) {
      return res.status(400).json({ message: 'Query month must be YYYY-MM' });
    }

    await syncSoftwareExpensesForMonth(rawMonth, auth.userId);

    const runExpensesQuery = (columns: string) =>
      supabase
        .from('expenses')
        .select(columns)
        .gte('expense_date', range.from)
        .lte('expense_date', range.to)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

    const [firstResult, team] = await Promise.all([runExpensesQuery(EXPENSE_SELECT_COLUMNS), listTeamUsersForExpenses()]);
    let data = firstResult.data;
    let error = firstResult.error;
    if (
      error &&
      (isMissingColumnError(error, 'assigned_user_id') || isMissingColumnError(error, 'employee_software_id'))
    ) {
      const fallback = await runExpensesQuery(EXPENSE_BASE_SELECT_COLUMNS);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      reportError(error, { source: 'api/expenses GET', month: rawMonth });
      if (isMissingTableError(error, 'expenses')) {
        return res.status(503).json({
          message: EXPENSE_SETUP_HINT,
          code: 'expenses_not_migrated',
        });
      }
      return res.status(500).json({
        message: 'Failed to load expenses',
        detail: formatDbError(error),
      });
    }

    const expenses = (data ?? [])
      .map((row) => mapExpenseRow(row as unknown as Record<string, unknown>))
      .filter((row): row is ExpenseListItem => row !== null);

    const enriched = await enrichExpenses(expenses, team.users);
    const total = enriched.reduce((sum, row) => sum + row.amount, 0);

    return res.status(200).json({
      month: rawMonth,
      from: range.from,
      to: range.to,
      total,
      expenses: enriched,
      team_users: team.users,
    });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const expense_date = typeof body.expense_date === 'string' ? body.expense_date.trim().slice(0, 10) : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const amountResult = parseIncomingAmountPkr(body);
    if ('error' in amountResult) {
      return res.status(400).json({ message: amountResult.error });
    }
    const amount = amountResult.pkr;
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
    const assigned_user_id = typeof body.assigned_user_id === 'string' ? body.assigned_user_id.trim() : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      return res.status(400).json({ message: 'expense_date must be YYYY-MM-DD' });
    }
    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }
    if (amount === null) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    if (categoryNeedsEmployee(category) && !assigned_user_id) {
      return res.status(400).json({ message: 'Employee is required for this category' });
    }

    let employee_software_id: string | null = null;
    if (category === 'Software' && assigned_user_id) {
      employee_software_id = await upsertSoftwareFromExpense({
        userId: assigned_user_id,
        softwareName: title,
        monthlyAmount: amount,
        notes,
        createdBy: auth.userId,
      });
      if (!employee_software_id) {
        return res.status(500).json({ message: 'Failed to link software subscription' });
      }
    }

    const insertPayload = {
      expense_date,
      title,
      amount,
      category,
      notes,
      assigned_user_id,
      employee_software_id,
      created_by: auth.userId,
      updated_at: new Date().toISOString(),
    };

    let { data, error } = await supabase
      .from('expenses')
      .insert(insertPayload)
      .select(EXPENSE_SELECT_COLUMNS)
      .single();

    if (
      error &&
      (isMissingColumnError(error, 'assigned_user_id') || isMissingColumnError(error, 'employee_software_id'))
    ) {
      const fallbackNotes =
        categoryNeedsEmployee(category) && assigned_user_id
          ? notesWithAssignee(notes, assigned_user_id)
          : notes;
      const { assigned_user_id: _assignedUserId, employee_software_id: _employeeSoftwareId, ...fallbackPayload } = {
        ...insertPayload,
        notes: fallbackNotes,
      };
      const fallback = await supabase
        .from('expenses')
        .insert(fallbackPayload)
        .select(EXPENSE_BASE_SELECT_COLUMNS)
        .single();
      data = fallback.data
        ? {
            ...fallback.data,
            assigned_user_id: assigned_user_id ?? null,
            employee_software_id: employee_software_id ?? null,
          }
        : null;
      error = fallback.error;
    }

    if (error || !data) {
      reportError(error ?? new Error('Missing insert row'), { source: 'api/expenses POST', userId: auth.userId });
      if (isMissingTableError(error, 'expenses')) {
        return res.status(503).json({
          message: EXPENSE_SETUP_HINT,
          code: 'expenses_not_migrated',
        });
      }
      return res.status(500).json({
        message: 'Failed to create expense',
        detail: formatDbError(error),
      });
    }

    await syncSoftwareExpenseAfterSoftwareChange(auth.userId, expenseMonthFromDate(expense_date));

    const mapped = mapExpenseRow(data as unknown as Record<string, unknown>);
    if (!mapped) {
      return res.status(500).json({ message: 'Created expense could not be read' });
    }

    const [enriched] = await enrichExpenses([mapped], []);
    return res.status(201).json({ expense: enriched });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
