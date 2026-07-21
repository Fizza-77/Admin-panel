import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingTableError } from '@/lib/db/errors';
import { monthDateRange, monthInputValue } from '@/lib/expenses/types';

export type PayrollMonthBonus = {
  user_id: string;
  pay_month: string;
  amount: number;
  notes: string | null;
};

function monthStart(month = monthInputValue()): string | null {
  return monthDateRange(month)?.from ?? null;
}

/** Map of userId -> bonus amount for a pay month. */
export async function loadPayrollBonusesForMonth(month = monthInputValue()): Promise<Map<string, number>> {
  const from = monthStart(month);
  if (!from) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('payroll_month_bonuses')
    .select('user_id, amount')
    .eq('pay_month', from);

  if (error) {
    if (!isMissingTableError(error, 'payroll_month_bonuses')) {
      reportError(error, { source: 'loadPayrollBonusesForMonth', month });
    }
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (typeof row.user_id !== 'string') {
      continue;
    }
    const amount = row.amount != null ? Number(row.amount) : 0;
    if (Number.isFinite(amount) && amount > 0) {
      map.set(row.user_id, amount);
    }
  }
  return map;
}

export async function getPayrollBonusForUser(
  userId: string,
  month = monthInputValue(),
): Promise<number> {
  const from = monthStart(month);
  if (!from) {
    return 0;
  }

  const { data, error } = await supabase
    .from('payroll_month_bonuses')
    .select('amount')
    .eq('user_id', userId)
    .eq('pay_month', from)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error, 'payroll_month_bonuses')) {
      reportError(error, { source: 'getPayrollBonusForUser', userId, month });
    }
    return 0;
  }

  const amount = data?.amount != null ? Number(data.amount) : 0;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export async function upsertPayrollBonus(params: {
  userId: string;
  amount: number;
  notes?: string | null;
  createdBy: string;
  month?: string;
}): Promise<{ ok: true; amount: number } | { ok: false; status: number; message: string }> {
  const month = params.month ?? monthInputValue();
  const from = monthStart(month);
  if (!from) {
    return { ok: false, status: 400, message: 'Invalid pay month' };
  }

  if (!Number.isFinite(params.amount) || params.amount < 0) {
    return { ok: false, status: 400, message: 'Bonus must be a non-negative number' };
  }

  const amount = Math.round(params.amount * 100) / 100;
  const notes =
    typeof params.notes === 'string' && params.notes.trim() ? params.notes.trim().slice(0, 500) : null;
  const now = new Date().toISOString();

  if (amount === 0) {
    const { error } = await supabase
      .from('payroll_month_bonuses')
      .delete()
      .eq('user_id', params.userId)
      .eq('pay_month', from);
    if (error && !isMissingTableError(error, 'payroll_month_bonuses')) {
      reportError(error, { source: 'upsertPayrollBonus.clear', userId: params.userId, month });
      return { ok: false, status: 500, message: 'Failed to clear bonus' };
    }
    if (error && isMissingTableError(error, 'payroll_month_bonuses')) {
      return {
        ok: false,
        status: 503,
        message:
          'Payroll bonuses are not set up yet. Run supabase/migrations/20260721150000_payroll_month_bonuses.sql',
      };
    }
    return { ok: true, amount: 0 };
  }

  const { error } = await supabase.from('payroll_month_bonuses').upsert(
    {
      user_id: params.userId,
      pay_month: from,
      amount,
      notes,
      created_by: params.createdBy,
      updated_at: now,
    },
    { onConflict: 'user_id,pay_month' },
  );

  if (error) {
    if (isMissingTableError(error, 'payroll_month_bonuses')) {
      return {
        ok: false,
        status: 503,
        message:
          'Payroll bonuses are not set up yet. Run supabase/migrations/20260721150000_payroll_month_bonuses.sql',
      };
    }
    reportError(error, { source: 'upsertPayrollBonus', userId: params.userId, month });
    return { ok: false, status: 500, message: 'Failed to save bonus' };
  }

  return { ok: true, amount };
}

/**
 * Remove salary bonuses for an employee from the given month onward.
 * Used when profile salary is cleared.
 */
export async function clearPayrollBonusesFromMonth(
  userId: string,
  fromMonth: string,
): Promise<void> {
  const from = monthStart(fromMonth);
  if (!from) {
    return;
  }

  const { error } = await supabase
    .from('payroll_month_bonuses')
    .delete()
    .eq('user_id', userId)
    .gte('pay_month', from);

  if (error && !isMissingTableError(error, 'payroll_month_bonuses')) {
    reportError(error, { source: 'clearPayrollBonusesFromMonth', userId, fromMonth });
  }
}
