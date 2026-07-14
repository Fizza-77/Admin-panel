import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { fetchAppProfileRow } from '@/lib/permissions/appProfileDb';
import {
  fetchMonthExpensesEnriched,
  filterExpensesForEmployee,
  totalEmployeeExpensesWithSalary,
} from '@/lib/expenses/expenseQueries';
import { monthInputValue } from '@/lib/expenses/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : monthInputValue();
  const [result, profile] = await Promise.all([
    fetchMonthExpensesEnriched(rawMonth, auth.userId),
    fetchAppProfileRow(userId),
  ]);

  if (!result.ok) {
    return res.status(result.status).json({
      message: result.message,
      code: result.code,
      detail: result.detail,
    });
  }

  const expenses = filterExpensesForEmployee(result.expenses, userId);
  const salary =
    profile.row?.salary != null && Number.isFinite(Number(profile.row.salary))
      ? Number(profile.row.salary)
      : null;
  const total = totalEmployeeExpensesWithSalary(expenses, salary);

  // When salary is set for the current/future month but no Payroll row yet, show it from the profile.
  const hasPayroll = expenses.some((row) => row.category === 'Payroll');
  const isCurrentOrFutureMonth = rawMonth >= monthInputValue();
  const displayExpenses =
    salary != null && salary > 0 && !hasPayroll && isCurrentOrFutureMonth
      ? [
          {
            id: `profile-salary-${userId}-${result.month}`,
            expense_date: result.from,
            title: 'Salary',
            amount: salary,
            category: 'Payroll',
            notes: 'From employee profile',
            created_by: userId,
            assigned_user_id: userId,
            employee_software_id: null,
            is_fixed: false,
            fixed_expense_id: null,
            created_at: result.from,
            updated_at: result.from,
            created_by_name: null,
            created_by_email: null,
            assigned_user_name: null,
            assigned_user_surname: null,
            assigned_user_email: null,
          },
          ...expenses,
        ]
      : expenses;

  return res.status(200).json({
    month: result.month,
    from: result.from,
    to: result.to,
    total,
    salary,
    expenses: displayExpenses,
  });
}
