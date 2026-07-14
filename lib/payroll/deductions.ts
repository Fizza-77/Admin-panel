import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingTableError } from '@/lib/db/errors';
import { monthDateRange, monthInputValue } from '@/lib/expenses/types';
import { getCurrentPayPeriod } from '@/lib/payroll/payPeriod';

export type PayrollMonthDeduction = {
  user_id: string;
  pay_month: string;
  amount: number;
  notes: string | null;
};

function monthStart(month = monthInputValue()): string | null {
  return monthDateRange(month)?.from ?? null;
}

/** Map of userId -> deduction amount for a pay month. */
export async function loadPayrollDeductionsForMonth(month = monthInputValue()): Promise<Map<string, number>> {
  const from = monthStart(month);
  if (!from) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('payroll_month_deductions')
    .select('user_id, amount')
    .eq('pay_month', from);

  if (error) {
    if (!isMissingTableError(error, 'payroll_month_deductions')) {
      reportError(error, { source: 'loadPayrollDeductionsForMonth', month });
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

export async function getPayrollDeductionForUser(
  userId: string,
  month = monthInputValue(),
): Promise<number> {
  const from = monthStart(month);
  if (!from) {
    return 0;
  }

  const { data, error } = await supabase
    .from('payroll_month_deductions')
    .select('amount')
    .eq('user_id', userId)
    .eq('pay_month', from)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error, 'payroll_month_deductions')) {
      reportError(error, { source: 'getPayrollDeductionForUser', userId, month });
    }
    return 0;
  }

  const amount = data?.amount != null ? Number(data.amount) : 0;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function netSalaryAfterDeduction(
  salary: number | null | undefined,
  deduction: number | null | undefined,
): number | null {
  if (salary == null || !Number.isFinite(salary) || salary <= 0) {
    return null;
  }
  const cut = deduction != null && Number.isFinite(deduction) && deduction > 0 ? deduction : 0;
  return Math.max(0, Math.round((salary - cut) * 100) / 100);
}

export async function upsertPayrollDeduction(params: {
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
    return { ok: false, status: 400, message: 'Deduction must be a non-negative number' };
  }

  const amount = Math.round(params.amount * 100) / 100;
  const notes =
    typeof params.notes === 'string' && params.notes.trim() ? params.notes.trim().slice(0, 500) : null;
  const now = new Date().toISOString();

  if (amount === 0) {
    const { error } = await supabase
      .from('payroll_month_deductions')
      .delete()
      .eq('user_id', params.userId)
      .eq('pay_month', from);
    if (error && !isMissingTableError(error, 'payroll_month_deductions')) {
      reportError(error, { source: 'upsertPayrollDeduction.clear', userId: params.userId, month });
      return { ok: false, status: 500, message: 'Failed to clear deduction' };
    }
    if (error && isMissingTableError(error, 'payroll_month_deductions')) {
      return {
        ok: false,
        status: 503,
        message:
          'Payroll deductions are not set up yet. Run supabase/migrations/20260714150000_payroll_month_deductions.sql',
      };
    }
    return { ok: true, amount: 0 };
  }

  const { error } = await supabase.from('payroll_month_deductions').upsert(
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
    if (isMissingTableError(error, 'payroll_month_deductions')) {
      return {
        ok: false,
        status: 503,
        message:
          'Payroll deductions are not set up yet. Run supabase/migrations/20260714150000_payroll_month_deductions.sql',
      };
    }
    reportError(error, { source: 'upsertPayrollDeduction', userId: params.userId, month });
    return { ok: false, status: 500, message: 'Failed to save deduction' };
  }

  return { ok: true, amount };
}

/**
 * Remove salary deductions for an employee from the given month onward.
 * Used when profile salary is cleared so Payroll no longer shows old cuts.
 */
export async function clearPayrollDeductionsFromMonth(
  userId: string,
  fromMonth: string,
): Promise<void> {
  const from = monthStart(fromMonth);
  if (!from) {
    return;
  }

  const { error } = await supabase
    .from('payroll_month_deductions')
    .delete()
    .eq('user_id', userId)
    .gte('pay_month', from);

  if (error && !isMissingTableError(error, 'payroll_month_deductions')) {
    reportError(error, { source: 'clearPayrollDeductionsFromMonth', userId, fromMonth });
  }
}

export function currentPayMonthCode(): string {
  return getCurrentPayPeriod().payPeriodCode;
}
