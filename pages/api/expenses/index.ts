import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { formatDbError, isMissingColumnError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { parseIncomingAmountPkr } from '@/lib/expenses/currency';
import { notesWithAssignee } from '@/lib/expenses/assigneeStorage';
import { listTeamUsersForExpenses } from '@/lib/expenses/listTeamUsers';
import {
  EXPENSE_BASE_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  expenseMonthFromDate,
  syncSoftwareExpenseAfterSoftwareChange,
  upsertSoftwareFromExpense,
} from '@/lib/expenses/softwareExpenseLink';
import { syncFixedExpensesForMonth } from '@/lib/expenses/fixedExpenseSync';
import {
  enrichExpenses,
  fetchMonthExpensesEnriched,
  mapExpenseRow,
} from '@/lib/expenses/expenseQueries';
import {
  categoryNeedsEmployee,
  monthInputValue,
} from '@/lib/expenses/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method === 'GET') {
    const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : monthInputValue();
    const result = await fetchMonthExpensesEnriched(rawMonth, auth.userId);
    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
        code: result.code,
        detail: result.detail,
      });
    }

    const team = await listTeamUsersForExpenses();

    return res.status(200).json({
      month: result.month,
      from: result.from,
      to: result.to,
      total: result.total,
      expenses: result.expenses,
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

    const is_fixed = body.is_fixed === true;

    let employee_software_id: string | null = null;
    if (category === 'Software' && assigned_user_id) {
      employee_software_id = await upsertSoftwareFromExpense({
        userId: assigned_user_id,
        softwareName: title,
        monthlyAmount: amount,
        notes,
        createdBy: auth.userId,
        billingCycle: is_fixed ? 'monthly' : 'one_time',
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
      is_fixed,
      fixed_expense_id: null,
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
      (isMissingColumnError(error, 'assigned_user_id') ||
        isMissingColumnError(error, 'employee_software_id') ||
        isMissingColumnError(error, 'is_fixed') ||
        isMissingColumnError(error, 'fixed_expense_id'))
    ) {
      const fallbackNotes = assigned_user_id ? notesWithAssignee(notes, assigned_user_id) : notes;
      const {
        assigned_user_id: _assignedUserId,
        employee_software_id: _employeeSoftwareId,
        is_fixed: _isFixed,
        fixed_expense_id: _fixedExpenseId,
        ...fallbackPayload
      } = {
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
            is_fixed: false,
            fixed_expense_id: null,
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
    if (is_fixed && !employee_software_id) {
      await syncFixedExpensesForMonth(expenseMonthFromDate(expense_date), auth.userId);
    }

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
