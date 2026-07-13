import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingColumnError } from '@/lib/db/errors';
import { monthlyEquivalent, type BillingCycle } from '@/lib/expenses/software';
import { monthDateRange, monthInputValue } from '@/lib/expenses/types';

export const EXPENSE_BASE_SELECT_COLUMNS =
  'id, expense_date, title, amount, category, notes, created_by, created_at, updated_at';

export const EXPENSE_SELECT_COLUMNS =
  `${EXPENSE_BASE_SELECT_COLUMNS}, assigned_user_id, employee_software_id`;

type SoftwareRow = {
  id: string;
  user_id: string;
  software_name: string;
  monthly_amount: number | null;
  billing_cycle: BillingCycle;
  notes: string | null;
  is_active: boolean;
};

export function expenseMonthFromDate(expenseDate: string): string {
  return expenseDate.slice(0, 7);
}

/** Ensure each active recurring software subscription has a monthly expense row for the given month. */
export async function syncSoftwareExpensesForMonth(month: string, createdBy: string): Promise<void> {
  const range = monthDateRange(month);
  if (!range) {
    return;
  }

  const { data, error } = await supabase
    .from('employee_software')
    .select('id, user_id, software_name, monthly_amount, billing_cycle, notes, is_active')
    .eq('is_active', true);

  if (error) {
    reportError(error, { source: 'syncSoftwareExpensesForMonth.list', month });
    return;
  }

  const now = new Date().toISOString();
  for (const sw of (data ?? []) as SoftwareRow[]) {
    if (sw.billing_cycle === 'one_time') {
      continue;
    }

    const amount = monthlyEquivalent(sw.monthly_amount, sw.billing_cycle);
    if (amount <= 0) {
      continue;
    }

    const { data: existing, error: findError } = await supabase
      .from('expenses')
      .select('id')
      .eq('employee_software_id', sw.id)
      .gte('expense_date', range.from)
      .lte('expense_date', range.to)
      .maybeSingle();

    if (findError) {
      if (isMissingColumnError(findError, 'employee_software_id')) {
        return;
      }
      reportError(findError, { source: 'syncSoftwareExpensesForMonth.find', softwareId: sw.id, month });
      continue;
    }

    const payload = {
      expense_date: range.from,
      title: sw.software_name,
      amount,
      category: 'Software',
      notes: sw.notes,
      assigned_user_id: sw.user_id,
      employee_software_id: sw.id,
      updated_at: now,
    };

    if (existing?.id) {
      const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', existing.id);
      if (updateError) {
        reportError(updateError, { source: 'syncSoftwareExpensesForMonth.update', softwareId: sw.id, month });
      }
      continue;
    }

    const { error: insertError } = await supabase.from('expenses').insert({
      ...payload,
      created_by: createdBy,
    });
    if (insertError) {
      if (isMissingColumnError(insertError, 'assigned_user_id') || isMissingColumnError(insertError, 'employee_software_id')) {
        return;
      }
      reportError(insertError, { source: 'syncSoftwareExpensesForMonth.insert', softwareId: sw.id, month });
    }
  }
}

export async function upsertSoftwareFromExpense(params: {
  userId: string;
  softwareName: string;
  monthlyAmount: number;
  notes: string | null;
  createdBy: string;
}): Promise<string | null> {
  const now = new Date().toISOString();
  const row = {
    user_id: params.userId,
    software_name: params.softwareName,
    monthly_amount: params.monthlyAmount,
    billing_cycle: 'monthly' as const,
    notes: params.notes,
    is_active: true,
    updated_at: now,
  };

  const { data: existing, error: findError } = await supabase
    .from('employee_software')
    .select('id')
    .eq('user_id', params.userId)
    .eq('software_name', params.softwareName)
    .maybeSingle();

  if (findError) {
    reportError(findError, { source: 'upsertSoftwareFromExpense.find', userId: params.userId });
    return null;
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('employee_software')
      .update(row)
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) {
      reportError(error, { source: 'upsertSoftwareFromExpense.update', softwareId: existing.id });
      return null;
    }
    return data.id as string;
  }

  const { data, error } = await supabase
    .from('employee_software')
    .insert({ ...row, created_by: params.createdBy })
    .select('id')
    .single();

  if (error) {
    reportError(error, { source: 'upsertSoftwareFromExpense.insert', userId: params.userId });
    return null;
  }

  return data.id as string;
}

export async function updateSoftwareFromLinkedExpense(params: {
  employeeSoftwareId: string;
  softwareName: string;
  monthlyAmount: number;
  notes: string | null;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from('employee_software')
    .update({
      software_name: params.softwareName,
      monthly_amount: params.monthlyAmount,
      user_id: params.userId,
      notes: params.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.employeeSoftwareId);

  if (error) {
    reportError(error, { source: 'updateSoftwareFromLinkedExpense', softwareId: params.employeeSoftwareId });
  }
}

export async function deleteExpensesForSoftware(softwareId: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('employee_software_id', softwareId);
  if (error) {
    if (isMissingColumnError(error, 'employee_software_id')) {
      return;
    }
    reportError(error, { source: 'deleteExpensesForSoftware', softwareId });
  }
}

export async function syncSoftwareExpenseAfterSoftwareChange(createdBy: string, month = monthInputValue()): Promise<void> {
  await syncSoftwareExpensesForMonth(month, createdBy);
}
