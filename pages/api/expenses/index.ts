import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRowsByUserIds } from '@/lib/permissions/appProfileDb';
import { formatDbError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { monthDateRange, monthInputValue, parseAmountInput, type ExpenseListItem } from '@/lib/expenses/types';

function mapExpenseRow(row: Record<string, unknown>): ExpenseListItem | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const expense_date = row.expense_date != null ? String(row.expense_date).slice(0, 10) : null;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const amount = row.amount != null ? Number(row.amount) : NaN;
  const created_by = typeof row.created_by === 'string' ? row.created_by : null;
  const created_at = typeof row.created_at === 'string' ? row.created_at : null;
  const updated_at = typeof row.updated_at === 'string' ? row.updated_at : null;

  if (!id || !expense_date || !title || !Number.isFinite(amount) || amount <= 0 || !created_by || !created_at || !updated_at) {
    return null;
  }

  return {
    id,
    expense_date,
    title,
    amount,
    category: typeof row.category === 'string' ? row.category.trim() || null : null,
    notes: typeof row.notes === 'string' ? row.notes.trim() || null : null,
    created_by,
    created_at,
    updated_at,
    created_by_name: null,
    created_by_email: null,
  };
}

async function enrichExpensesWithCreators(expenses: ExpenseListItem[]): Promise<ExpenseListItem[]> {
  if (expenses.length === 0) {
    return expenses;
  }

  const creatorIds = Array.from(new Set(expenses.map((e) => e.created_by)));
  const profiles = await fetchAppProfileRowsByUserIds(creatorIds);
  const emailById = new Map<string, string | null>();

  await Promise.all(
    creatorIds.map(async (userId) => {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (error) {
        reportError(error, { source: 'api/expenses enrichCreators', userId });
        emailById.set(userId, null);
        return;
      }
      emailById.set(userId, data.user?.email ?? null);
    }),
  );

  return expenses.map((expense) => {
    const profile = profiles.byUserId.get(expense.created_by);
    return {
      ...expense,
      created_by_name: profile?.display_name ?? null,
      created_by_email: emailById.get(expense.created_by) ?? null,
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

    const { data, error } = await supabase
      .from('expenses')
      .select('id, expense_date, title, amount, category, notes, created_by, created_at, updated_at')
      .gte('expense_date', range.from)
      .lte('expense_date', range.to)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

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
      .map((row) => mapExpenseRow(row as Record<string, unknown>))
      .filter((row): row is ExpenseListItem => row !== null);

    const enriched = await enrichExpensesWithCreators(expenses);
    const total = enriched.reduce((sum, row) => sum + row.amount, 0);

    return res.status(200).json({
      month: rawMonth,
      from: range.from,
      to: range.to,
      total,
      expenses: enriched,
    });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    const expense_date = typeof body.expense_date === 'string' ? body.expense_date.trim().slice(0, 10) : '';
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    const amount = parseAmountInput(typeof body.amount === 'string' || typeof body.amount === 'number' ? String(body.amount) : '');
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 80) || null : null;
    const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 500) || null : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(expense_date)) {
      return res.status(400).json({ message: 'expense_date must be YYYY-MM-DD' });
    }
    if (!title) {
      return res.status(400).json({ message: 'title is required' });
    }
    if (amount === null) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        expense_date,
        title,
        amount,
        category,
        notes,
        created_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .select('id, expense_date, title, amount, category, notes, created_by, created_at, updated_at')
      .single();

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

    const mapped = mapExpenseRow(data as Record<string, unknown>);
    if (!mapped) {
      return res.status(500).json({ message: 'Created expense could not be read' });
    }

    const [enriched] = await enrichExpensesWithCreators([mapped]);
    return res.status(201).json({ expense: enriched });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
