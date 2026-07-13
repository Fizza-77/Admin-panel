import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { formatDbError, isMissingColumnError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { parseIncomingAmountPkr } from '@/lib/expenses/currency';
import { notesWithAssignee, resolveAssigneeId, stripAssigneeFromNotes } from '@/lib/expenses/assigneeStorage';
import {
  EXPENSE_BASE_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  expenseMonthFromDate,
  syncSoftwareExpenseAfterSoftwareChange,
  updateSoftwareFromLinkedExpense,
  upsertSoftwareFromExpense,
} from '@/lib/expenses/softwareExpenseLink';
import { categoryNeedsEmployee } from '@/lib/expenses/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const expenseId = req.query.expenseId;
  if (typeof expenseId !== 'string') {
    return res.status(400).json({ message: 'Invalid expense id' });
  }

  if (req.method === 'PATCH') {
    let { data: existing, error: loadError } = await supabase
      .from('expenses')
      .select(EXPENSE_SELECT_COLUMNS)
      .eq('id', expenseId)
      .maybeSingle();

    const linkColumnsAvailable =
      !loadError ||
      (!isMissingColumnError(loadError, 'assigned_user_id') && !isMissingColumnError(loadError, 'employee_software_id'));

    if (!linkColumnsAvailable) {
      const fallback = await supabase
        .from('expenses')
        .select(EXPENSE_BASE_SELECT_COLUMNS)
        .eq('id', expenseId)
        .maybeSingle();
      existing = fallback.data
        ? {
            ...fallback.data,
            assigned_user_id: null,
            employee_software_id: null,
          }
        : null;
      loadError = fallback.error;
    }

    if (loadError) {
      reportError(loadError, { source: 'api/expenses PATCH load', expenseId });
      return res.status(500).json({ message: 'Failed to load expense' });
    }
    if (!existing) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const existingNotes = typeof existing.notes === 'string' ? existing.notes : null;
    const existingAssigneeId = linkColumnsAvailable
      ? (typeof existing.assigned_user_id === 'string' ? existing.assigned_user_id : null)
      : resolveAssigneeId(null, existingNotes);

    const body = req.body ?? {};
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.expense_date !== undefined) {
      const expense_date = typeof body.expense_date === 'string' ? body.expense_date.trim().slice(0, 10) : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
        return res.status(400).json({ message: 'expense_date must be YYYY-MM-DD' });
      }
      updates.expense_date = expense_date;
    }

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
      if (!title) {
        return res.status(400).json({ message: 'title cannot be empty' });
      }
      updates.title = title;
    }

    if (body.amount !== undefined) {
      const amountResult = parseIncomingAmountPkr(body);
      if ('error' in amountResult) {
        return res.status(400).json({ message: amountResult.error });
      }
      if (amountResult.pkr === null) {
        return res.status(400).json({ message: 'amount must be a positive number' });
      }
      updates.amount = amountResult.pkr;
    }

    if (body.category !== undefined) {
      updates.category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) || null : null;
    }

    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
    }

    if (body.assigned_user_id !== undefined) {
      updates.assigned_user_id =
        typeof body.assigned_user_id === 'string' && body.assigned_user_id.trim()
          ? body.assigned_user_id.trim()
          : null;
    }

    if (!linkColumnsAvailable) {
      delete updates.assigned_user_id;
      delete updates.employee_software_id;
    }

    const nextCategory =
      updates.category !== undefined ? (updates.category as string | null) : (existing.category as string | null);
    const nextAssignedUserId = linkColumnsAvailable
      ? updates.assigned_user_id !== undefined
        ? (updates.assigned_user_id as string | null)
        : (typeof existing.assigned_user_id === 'string' ? existing.assigned_user_id : null)
      : body.assigned_user_id !== undefined
        ? typeof body.assigned_user_id === 'string' && body.assigned_user_id.trim()
          ? body.assigned_user_id.trim()
          : null
        : existingAssigneeId;
    const nextTitle = updates.title !== undefined ? (updates.title as string) : (existing.title as string);
    const nextAmount = updates.amount !== undefined ? (updates.amount as number) : Number(existing.amount);
    const nextNotes =
      updates.notes !== undefined ? (updates.notes as string | null) : stripAssigneeFromNotes(existingNotes);

    if (categoryNeedsEmployee(nextCategory) && !nextAssignedUserId) {
      return res.status(400).json({ message: 'Employee is required for this category' });
    }

    if (!linkColumnsAvailable) {
      if (categoryNeedsEmployee(nextCategory)) {
        updates.notes = notesWithAssignee(nextNotes, nextAssignedUserId);
      } else {
        updates.notes = nextNotes;
      }
    }

    if (linkColumnsAvailable && !categoryNeedsEmployee(nextCategory)) {
      updates.assigned_user_id = null;
      if (!existing.employee_software_id) {
        updates.employee_software_id = null;
      }
    }

    if (linkColumnsAvailable && nextCategory === 'Software' && nextAssignedUserId) {
      if (existing.employee_software_id) {
        await updateSoftwareFromLinkedExpense({
          employeeSoftwareId: existing.employee_software_id as string,
          softwareName: nextTitle,
          monthlyAmount: nextAmount,
          notes: nextNotes,
          userId: nextAssignedUserId,
        });
        updates.employee_software_id = existing.employee_software_id;
      } else {
        const softwareId = await upsertSoftwareFromExpense({
          userId: nextAssignedUserId,
          softwareName: nextTitle,
          monthlyAmount: nextAmount,
          notes: nextNotes,
          createdBy: auth.userId,
        });
        if (!softwareId) {
          return res.status(500).json({ message: 'Failed to link software subscription' });
        }
        updates.employee_software_id = softwareId;
      }
    } else if (linkColumnsAvailable && nextCategory !== 'Software') {
      updates.employee_software_id = null;
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const selectColumns = linkColumnsAvailable ? EXPENSE_SELECT_COLUMNS : EXPENSE_BASE_SELECT_COLUMNS;
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expenseId)
      .select(selectColumns)
      .maybeSingle();

    if (error) {
      reportError(error, { source: 'api/expenses PATCH', expenseId });
      if (isMissingTableError(error, 'expenses')) {
        return res.status(503).json({
          message: EXPENSE_SETUP_HINT,
          code: 'expenses_not_migrated',
        });
      }
      return res.status(500).json({
        message: 'Failed to update expense',
        detail: formatDbError(error),
      });
    }

    if (!data) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    const expenseDate =
      updates.expense_date !== undefined ? (updates.expense_date as string) : (existing.expense_date as string);
    await syncSoftwareExpenseAfterSoftwareChange(auth.userId, expenseMonthFromDate(expenseDate));

    return res.status(200).json({ expense: data });
  }

  if (req.method === 'DELETE') {
    const { data, error } = await supabase.from('expenses').delete().eq('id', expenseId).select('id').maybeSingle();

    if (error) {
      reportError(error, { source: 'api/expenses DELETE', expenseId });
      if (isMissingTableError(error, 'expenses')) {
        return res.status(503).json({
          message: EXPENSE_SETUP_HINT,
          code: 'expenses_not_migrated',
        });
      }
      return res.status(500).json({
        message: 'Failed to delete expense',
        detail: formatDbError(error),
      });
    }

    if (!data) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', ['PATCH', 'DELETE']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
