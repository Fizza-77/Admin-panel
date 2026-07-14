import { supabase } from '@/lib/supabase/server';
import { fetchAppProfileRowsByUserIds } from '@/lib/permissions/appProfileDb';
import { formatDbError, isMissingColumnError, isMissingTableError, EXPENSE_SETUP_HINT } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { resolveAssigneeId, stripAssigneeFromNotes } from '@/lib/expenses/assigneeStorage';
import { listTeamUsersForExpenses } from '@/lib/expenses/listTeamUsers';
import {
  EXPENSE_BASE_SELECT_COLUMNS,
  EXPENSE_SELECT_COLUMNS,
  syncSoftwareExpensesForMonth,
} from '@/lib/expenses/softwareExpenseLink';
import { syncPayrollExpensesForMonth } from '@/lib/expenses/payrollExpenseSync';
import { syncFixedExpensesForMonth } from '@/lib/expenses/fixedExpenseSync';
import { monthDateRange, type ExpenseListItem } from '@/lib/expenses/types';

export function mapExpenseRow(row: Record<string, unknown>): ExpenseListItem | null {
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
  const is_fixed = row.is_fixed === true;
  const fixed_expense_id = typeof row.fixed_expense_id === 'string' ? row.fixed_expense_id : null;

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
    is_fixed,
    fixed_expense_id,
    created_at,
    updated_at,
    created_by_name: null,
    created_by_email: null,
    assigned_user_name: null,
    assigned_user_surname: null,
    assigned_user_email: null,
  };
}

export async function enrichExpenses(
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
        reportError(error, { source: 'expenseQueries enrich', userId });
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

export type MonthExpensesResult =
  | {
      ok: true;
      month: string;
      from: string;
      to: string;
      expenses: ExpenseListItem[];
      total: number;
    }
  | {
      ok: false;
      status: number;
      message: string;
      code?: string;
      detail?: string;
    };

export async function fetchMonthExpensesEnriched(rawMonth: string, authUserId: string): Promise<MonthExpensesResult> {
  const range = monthDateRange(rawMonth);
  if (!range) {
    return { ok: false, status: 400, message: 'Query month must be YYYY-MM' };
  }

  await Promise.all([
    syncSoftwareExpensesForMonth(rawMonth, authUserId),
    syncPayrollExpensesForMonth(rawMonth, authUserId),
    syncFixedExpensesForMonth(rawMonth, authUserId),
  ]);

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
    reportError(error, { source: 'expenseQueries fetchMonth', month: rawMonth });
    if (isMissingTableError(error, 'expenses')) {
      return {
        ok: false,
        status: 503,
        message: EXPENSE_SETUP_HINT,
        code: 'expenses_not_migrated',
      };
    }
    return {
      ok: false,
      status: 500,
      message: 'Failed to load expenses',
      detail: formatDbError(error),
    };
  }

  const expenses = (data ?? [])
    .map((row) => mapExpenseRow(row as unknown as Record<string, unknown>))
    .filter((row): row is ExpenseListItem => row !== null)
    // Templates are synced into monthly copies — hide the template row so totals aren't doubled.
    // Subscription-linked software rows keep is_fixed for the Fixed badge and must stay visible.
    .filter((row) => !(row.is_fixed && !row.fixed_expense_id && !row.employee_software_id));

  const enriched = await enrichExpenses(expenses, team.users);
  const total = enriched.reduce((sum, row) => sum + row.amount, 0);

  return {
    ok: true,
    month: rawMonth,
    from: range.from,
    to: range.to,
    expenses: enriched,
    total,
  };
}

export function filterExpensesForEmployee(expenses: ExpenseListItem[], userId: string): ExpenseListItem[] {
  return expenses.filter((expense) => expense.assigned_user_id === userId);
}

/** Month total for an employee. Existing Payroll expense rows are historical and win over profile salary. */
export function totalEmployeeExpensesWithSalary(
  expenses: ExpenseListItem[],
  salary: number | null | undefined,
): number {
  const hasPayrollExpense = expenses.some((row) => row.category === 'Payroll');
  if (hasPayrollExpense) {
    return expenses.reduce((sum, row) => sum + row.amount, 0);
  }

  const nonPayrollTotal = expenses.reduce((sum, row) => sum + row.amount, 0);
  if (salary != null && Number.isFinite(salary) && salary > 0) {
    return nonPayrollTotal + salary;
  }
  return nonPayrollTotal;
}

export function sumExpensesByEmployee(expenses: ExpenseListItem[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const expense of expenses) {
    if (!expense.assigned_user_id) {
      continue;
    }
    totals[expense.assigned_user_id] = (totals[expense.assigned_user_id] ?? 0) + expense.amount;
  }
  return totals;
}
