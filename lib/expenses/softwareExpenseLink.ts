import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingColumnError } from '@/lib/db/errors';
import { notesWithAssignee, parseAssigneeIdFromNotes } from '@/lib/expenses/assigneeStorage';
import { monthlyEquivalent, type BillingCycle } from '@/lib/expenses/software';
import { monthDateRange, monthInputValue } from '@/lib/expenses/types';

export const EXPENSE_BASE_SELECT_COLUMNS =
  'id, expense_date, title, amount, category, notes, created_by, created_at, updated_at, is_fixed, fixed_expense_id';

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
  created_at?: string | null;
};

export function expenseMonthFromDate(expenseDate: string): string {
  return expenseDate.slice(0, 7);
}

/** Earliest month this software subscription should appear (fixed start or created_at). */
async function softwareExpenseStartMonth(sw: SoftwareRow): Promise<string> {
  const { data: fixedAnchor, error: fixedError } = await supabase
    .from('expenses')
    .select('expense_date')
    .eq('employee_software_id', sw.id)
    .eq('is_fixed', true)
    .order('expense_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fixedError && fixedAnchor?.expense_date) {
    return expenseMonthFromDate(String(fixedAnchor.expense_date));
  }

  if (typeof sw.created_at === 'string' && sw.created_at.length >= 7) {
    return expenseMonthFromDate(sw.created_at);
  }

  return monthInputValue();
}

async function findSoftwareExpenseForMonth(
  sw: SoftwareRow,
  range: { from: string; to: string },
  linkColumnsAvailable: boolean,
): Promise<{ id: string | null; linkColumnsAvailable: boolean }> {
  if (linkColumnsAvailable) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id')
      .eq('employee_software_id', sw.id)
      .gte('expense_date', range.from)
      .lte('expense_date', range.to)
      .maybeSingle();

    if (error && isMissingColumnError(error, 'employee_software_id')) {
      return findSoftwareExpenseForMonth(sw, range, false);
    }
    if (error) {
      reportError(error, { source: 'findSoftwareExpenseForMonth', softwareId: sw.id });
      return { id: null, linkColumnsAvailable: true };
    }
    return { id: typeof data?.id === 'string' ? data.id : null, linkColumnsAvailable: true };
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('id, notes, assigned_user_id, title')
    .eq('category', 'Software')
    .eq('title', sw.software_name)
    .gte('expense_date', range.from)
    .lte('expense_date', range.to);

  if (error) {
    reportError(error, { source: 'findSoftwareExpenseForMonth.fallback', softwareId: sw.id });
    return { id: null, linkColumnsAvailable: false };
  }

  const match = (data ?? []).find((row) => {
    const assignee =
      typeof row.assigned_user_id === 'string'
        ? row.assigned_user_id
        : parseAssigneeIdFromNotes(row.notes as string | null);
    return assignee === sw.user_id;
  });

  return { id: typeof match?.id === 'string' ? match.id : null, linkColumnsAvailable: false };
}

async function upsertSoftwareExpenseRow(params: {
  sw: SoftwareRow;
  range: { from: string; to: string };
  amount: number;
  existingId: string | null;
  createdBy: string;
  linkColumnsAvailable: boolean;
}): Promise<boolean> {
  const now = new Date().toISOString();
  const basePayload = {
    expense_date: params.range.from,
    title: params.sw.software_name,
    amount: params.amount,
    category: 'Software',
    updated_at: now,
  };

  if (params.existingId) {
    const updatePayload = params.linkColumnsAvailable
      ? {
          ...basePayload,
          notes: params.sw.notes,
          assigned_user_id: params.sw.user_id,
          employee_software_id: params.sw.id,
        }
      : {
          ...basePayload,
          notes: notesWithAssignee(params.sw.notes, params.sw.user_id),
        };

    const { error: updateError } = await supabase.from('expenses').update(updatePayload).eq('id', params.existingId);
    if (updateError) {
      reportError(updateError, {
        source: 'syncSoftwareExpensesForMonth.update',
        softwareId: params.sw.id,
      });
    }
    return params.linkColumnsAvailable;
  }

  const insertPayload = params.linkColumnsAvailable
    ? {
        ...basePayload,
        notes: params.sw.notes,
        assigned_user_id: params.sw.user_id,
        employee_software_id: params.sw.id,
        created_by: params.createdBy,
      }
    : {
        ...basePayload,
        notes: notesWithAssignee(params.sw.notes, params.sw.user_id),
        created_by: params.createdBy,
      };

  const { error: insertError } = await supabase.from('expenses').insert(insertPayload);
  if (
    insertError &&
    params.linkColumnsAvailable &&
    (isMissingColumnError(insertError, 'assigned_user_id') || isMissingColumnError(insertError, 'employee_software_id'))
  ) {
    const { error: retryError } = await supabase.from('expenses').insert({
      ...basePayload,
      notes: notesWithAssignee(params.sw.notes, params.sw.user_id),
      created_by: params.createdBy,
    });
    if (retryError) {
      reportError(retryError, { source: 'syncSoftwareExpensesForMonth.insert.fallback', softwareId: params.sw.id });
    }
    return false;
  }

  if (insertError) {
    reportError(insertError, { source: 'syncSoftwareExpensesForMonth.insert', softwareId: params.sw.id });
  }
  return params.linkColumnsAvailable;
}

/** Ensure each active recurring software subscription has a monthly expense row for the given month. */
export async function syncSoftwareExpensesForMonth(month: string, createdBy: string): Promise<void> {
  const range = monthDateRange(month);
  if (!range) {
    return;
  }

  const { data, error } = await supabase
    .from('employee_software')
    .select('id, user_id, software_name, monthly_amount, billing_cycle, notes, is_active, created_at')
    .eq('is_active', true);

  if (error) {
    reportError(error, { source: 'syncSoftwareExpensesForMonth.list', month });
    return;
  }

  let linkColumnsAvailable = true;
  for (const sw of (data ?? []) as SoftwareRow[]) {
    if (sw.billing_cycle === 'one_time') {
      continue;
    }

    const amount = monthlyEquivalent(sw.monthly_amount, sw.billing_cycle);
    if (amount <= 0) {
      continue;
    }

    const startMonth = await softwareExpenseStartMonth(sw);
    const startRange = monthDateRange(startMonth);
    if (startRange) {
      const { error: pruneError } = await supabase
        .from('expenses')
        .delete()
        .eq('employee_software_id', sw.id)
        .lt('expense_date', startRange.from);
      if (pruneError && !isMissingColumnError(pruneError, 'employee_software_id')) {
        reportError(pruneError, {
          source: 'syncSoftwareExpensesForMonth.pruneBeforeStart',
          softwareId: sw.id,
          startMonth,
        });
      }
    }

    if (month < startMonth) {
      continue;
    }

    const { id: existingId, linkColumnsAvailable: columnsOk } = await findSoftwareExpenseForMonth(
      sw,
      range,
      linkColumnsAvailable,
    );
    linkColumnsAvailable = await upsertSoftwareExpenseRow({
      sw,
      range,
      amount,
      existingId,
      createdBy,
      linkColumnsAvailable: columnsOk,
    });
  }
}

export async function upsertSoftwareFromExpense(params: {
  userId: string;
  softwareName: string;
  monthlyAmount: number;
  notes: string | null;
  createdBy: string;
  billingCycle?: 'monthly' | 'one_time';
}): Promise<string | null> {
  const now = new Date().toISOString();
  const row = {
    user_id: params.userId,
    software_name: params.softwareName,
    monthly_amount: params.monthlyAmount,
    billing_cycle: params.billingCycle ?? 'monthly',
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
  billingCycle?: 'monthly' | 'one_time';
}): Promise<void> {
  const updates: Record<string, unknown> = {
    software_name: params.softwareName,
    monthly_amount: params.monthlyAmount,
    user_id: params.userId,
    notes: params.notes,
    updated_at: new Date().toISOString(),
  };
  if (params.billingCycle) {
    updates.billing_cycle = params.billingCycle;
  }
  const { error } = await supabase
    .from('employee_software')
    .update(updates)
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
