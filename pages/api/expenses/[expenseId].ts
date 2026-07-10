import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { formatDbError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { parseAmountInput } from '@/lib/expenses/types';

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
      const amount = parseAmountInput(
        typeof body.amount === 'string' || typeof body.amount === 'number' ? String(body.amount) : '',
      );
      if (amount === null) {
        return res.status(400).json({ message: 'amount must be a positive number' });
      }
      updates.amount = amount;
    }

    if (body.category !== undefined) {
      updates.category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) || null : null;
    }

    if (body.notes !== undefined) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', expenseId)
      .select('id, expense_date, title, amount, category, notes, created_by, created_at, updated_at')
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
