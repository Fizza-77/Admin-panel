import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isMissingColumnError, isMissingTableError } from '@/lib/db/errors';
import { employeeFullName } from '@/lib/employees/profile';
import { notesWithAssignee, parseAssigneeIdFromNotes } from '@/lib/expenses/assigneeStorage';
import { expenseMonthFromDate } from '@/lib/expenses/softwareExpenseLink';
import { monthDateRange, monthInputValue } from '@/lib/expenses/types';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { loadPayrollDeductionsForMonth, netSalaryAfterDeduction } from '@/lib/payroll/deductions';

async function findPayrollExpenseForMonth(params: {
  userId: string;
  range: { from: string; to: string };
  linkColumnsAvailable: boolean;
}): Promise<{ id: string | null; linkColumnsAvailable: boolean }> {
  if (params.linkColumnsAvailable) {
    const { data, error } = await supabase
      .from('expenses')
      .select('id')
      .eq('category', 'Payroll')
      .eq('assigned_user_id', params.userId)
      .gte('expense_date', params.range.from)
      .lte('expense_date', params.range.to)
      .maybeSingle();

    if (error && isMissingColumnError(error, 'assigned_user_id')) {
      return findPayrollExpenseForMonth({ ...params, linkColumnsAvailable: false });
    }
    if (error) {
      reportError(error, { source: 'findPayrollExpenseForMonth', userId: params.userId });
      return { id: null, linkColumnsAvailable: params.linkColumnsAvailable };
    }
    return { id: typeof data?.id === 'string' ? data.id : null, linkColumnsAvailable: true };
  }

  const { data, error } = await supabase
    .from('expenses')
    .select('id, notes')
    .eq('category', 'Payroll')
    .gte('expense_date', params.range.from)
    .lte('expense_date', params.range.to);

  if (error) {
    reportError(error, { source: 'findPayrollExpenseForMonth.fallback', userId: params.userId });
    return { id: null, linkColumnsAvailable: false };
  }

  const match = (data ?? []).find((row) => parseAssigneeIdFromNotes(row.notes as string | null) === params.userId);
  return { id: typeof match?.id === 'string' ? match.id : null, linkColumnsAvailable: false };
}

async function loadExcludedPayrollUserIds(monthStart: string): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from('expense_payroll_month_exclusions')
    .select('user_id')
    .eq('expense_month', monthStart);

  if (error) {
    if (isMissingTableError(error, 'expense_payroll_month_exclusions')) {
      return null;
    }
    reportError(error, { source: 'loadExcludedPayrollUserIds', monthStart });
    return new Set();
  }

  return new Set(
    (data ?? [])
      .map((row) => (typeof row.user_id === 'string' ? row.user_id : null))
      .filter((id): id is string => Boolean(id)),
  );
}

/** Skip payroll expense for one employee in one month — does not change profile salary. */
export async function excludePayrollExpenseForMonth(userId: string, month: string): Promise<boolean> {
  const range = monthDateRange(month);
  if (!range) {
    return false;
  }

  const { error } = await supabase.from('expense_payroll_month_exclusions').upsert(
    {
      user_id: userId,
      expense_month: range.from,
    },
    { onConflict: 'user_id,expense_month' },
  );

  if (error) {
    if (isMissingTableError(error, 'expense_payroll_month_exclusions')) {
      reportError(error, { source: 'excludePayrollExpenseForMonth.missingTable', userId, month });
      return false;
    }
    reportError(error, { source: 'excludePayrollExpenseForMonth', userId, month });
    return false;
  }

  return true;
}

/**
 * Allow payroll to sync again for this employee from a month forward
 * after prior deletes-from-expenses (mirrors removing payroll when salary is cleared).
 */
export async function clearPayrollExpenseExclusionsFromMonth(userId: string, fromMonth: string): Promise<void> {
  const range = monthDateRange(fromMonth);
  if (!range) {
    return;
  }

  const { error } = await supabase
    .from('expense_payroll_month_exclusions')
    .delete()
    .eq('user_id', userId)
    .gte('expense_month', range.from);

  if (error && !isMissingTableError(error, 'expense_payroll_month_exclusions')) {
    reportError(error, { source: 'clearPayrollExpenseExclusionsFromMonth', userId, fromMonth });
  }
}

function shiftPayMonth(month: string, delta: number): string {
  const [year, monthPart] = month.split('-').map(Number);
  return monthInputValue(new Date(year, monthPart - 1 + delta, 1));
}

/**
 * Sync payroll expenses for `fromMonth` and the following months (default: 11 ahead).
 * Past months are left alone by syncPayrollExpensesForMonth rules.
 */
export async function syncPayrollExpensesFromMonth(
  fromMonth: string,
  createdBy: string,
  monthsAhead = 11,
): Promise<void> {
  const ahead = Math.max(0, Math.floor(monthsAhead));
  for (let i = 0; i <= ahead; i += 1) {
    await syncPayrollExpensesForMonth(shiftPayMonth(fromMonth, i), createdBy);
  }
}

/**
 * Delete a payroll expense for a single month only.
 * Never updates employee profile salary — other months still sync from the saved salary.
 */
export async function deletePayrollExpenseForMonth(params: {
  expenseId: string;
  userId: string;
  expenseDate: string;
}): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const month = expenseMonthFromDate(params.expenseDate);
  const range = monthDateRange(month);
  if (!range) {
    return { ok: false, status: 400, message: 'Invalid expense date' };
  }

  const excluded = await excludePayrollExpenseForMonth(params.userId, month);
  if (!excluded) {
    return {
      ok: false,
      status: 503,
      message:
        'Payroll month exclusions are not set up yet. Run supabase/migrations/20260714140000_expense_payroll_month_exclusions.sql',
    };
  }

  const { error } = await supabase.from('expenses').delete().eq('id', params.expenseId);
  if (error) {
    reportError(error, {
      source: 'deletePayrollExpenseForMonth',
      expenseId: params.expenseId,
      userId: params.userId,
      month,
    });
    return { ok: false, status: 500, message: 'Failed to delete payroll expense for this month' };
  }

  return { ok: true };
}

/**
 * Remove salary-linked Payroll expenses for an employee from the given month onward.
 * Does not change historical months before `fromMonth`.
 */
export async function removePayrollExpensesForEmployeeFromMonth(
  userId: string,
  fromMonth: string,
): Promise<void> {
  const range = monthDateRange(fromMonth);
  if (!range) {
    return;
  }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('category', 'Payroll')
    .eq('assigned_user_id', userId)
    .gte('expense_date', range.from);

  if (error) {
    if (isMissingColumnError(error, 'assigned_user_id')) {
      const { data, error: listError } = await supabase
        .from('expenses')
        .select('id, notes')
        .eq('category', 'Payroll')
        .gte('expense_date', range.from);
      if (listError) {
        reportError(listError, {
          source: 'removePayrollExpensesForEmployeeFromMonth.fallbackList',
          userId,
          fromMonth,
        });
        return;
      }
      const ids = (data ?? [])
        .filter((row) => parseAssigneeIdFromNotes(row.notes as string | null) === userId)
        .map((row) => row.id as string)
        .filter(Boolean);
      if (ids.length === 0) {
        return;
      }
      const { error: deleteError } = await supabase.from('expenses').delete().in('id', ids);
      if (deleteError) {
        reportError(deleteError, {
          source: 'removePayrollExpensesForEmployeeFromMonth.fallbackDelete',
          userId,
          fromMonth,
        });
      }
      return;
    }
    reportError(error, { source: 'removePayrollExpensesForEmployeeFromMonth', userId, fromMonth });
  }
}

/** Ensure each employee with a salary has a Payroll expense row for the given month. */
export async function syncPayrollExpensesForMonth(month: string, createdBy: string): Promise<void> {
  const range = monthDateRange(month);
  if (!range) {
    return;
  }

  const { rows, error } = await listPayrollEmployees();
  if (error || !rows) {
    reportError(error ?? new Error('listPayrollEmployees failed'), { source: 'syncPayrollExpensesForMonth.list', month });
    return;
  }

  const excludedUserIds = await loadExcludedPayrollUserIds(range.from);
  const deductionsByUser = await loadPayrollDeductionsForMonth(month);
  const currentMonth = monthInputValue();
  const isPastMonth = month < currentMonth;
  let linkColumnsAvailable = true;
  const now = new Date().toISOString();

  for (const employee of rows) {
    // No current salary: leave any past payroll rows alone (historical months stay paid-as-recorded).
    // Clearing salary on the profile removes from the clearance month forward separately.
    if (employee.salary == null || employee.salary <= 0) {
      continue;
    }

    if (excludedUserIds?.has(employee.user_id)) {
      continue;
    }

    const title = employeeFullName(employee.display_name, employee.surname, employee.email);
    const { id: existingId, linkColumnsAvailable: columnsOk } = await findPayrollExpenseForMonth({
      userId: employee.user_id,
      range,
      linkColumnsAvailable,
    });
    linkColumnsAvailable = columnsOk;

    // Past months keep the amount that was recorded — don't overwrite with today's salary.
    if (existingId && isPastMonth) {
      continue;
    }

    // Don't invent payroll history for past months that never had a row.
    if (!existingId && isPastMonth) {
      continue;
    }

    const deduction = deductionsByUser.get(employee.user_id) ?? 0;
    const netAmount = netSalaryAfterDeduction(employee.salary, deduction);
    if (netAmount == null || netAmount <= 0) {
      continue;
    }

    const payload: Record<string, unknown> = {
      expense_date: range.from,
      title,
      amount: netAmount,
      category: 'Payroll',
      notes: deduction > 0 ? `Base ${employee.salary}; deduction ${deduction}` : null,
      updated_at: now,
    };

    if (linkColumnsAvailable) {
      payload.assigned_user_id = employee.user_id;
    } else {
      payload.notes = notesWithAssignee(
        deduction > 0 ? `Base ${employee.salary}; deduction ${deduction}` : null,
        employee.user_id,
      );
    }

    if (existingId) {
      const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', existingId);
      if (updateError) {
        reportError(updateError, { source: 'syncPayrollExpensesForMonth.update', userId: employee.user_id, month });
      }
      continue;
    }

    const insertPayload = {
      ...payload,
      created_by: createdBy,
    };

    const { error: insertError } = await supabase.from('expenses').insert(insertPayload);
    if (insertError) {
      if (isMissingColumnError(insertError, 'assigned_user_id')) {
        linkColumnsAvailable = false;
        const { error: retryError } = await supabase.from('expenses').insert({
          expense_date: range.from,
          title,
          amount: netAmount,
          category: 'Payroll',
          notes: notesWithAssignee(
            deduction > 0 ? `Base ${employee.salary}; deduction ${deduction}` : null,
            employee.user_id,
          ),
          created_by: createdBy,
          updated_at: now,
        });
        if (retryError) {
          reportError(retryError, { source: 'syncPayrollExpensesForMonth.insert.fallback', userId: employee.user_id, month });
        }
        continue;
      }
      reportError(insertError, { source: 'syncPayrollExpensesForMonth.insert', userId: employee.user_id, month });
    }
  }
}
