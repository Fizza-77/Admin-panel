import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import {
  fetchMonthExpensesEnriched,
  filterExpensesForEmployee,
  totalEmployeeExpensesWithSalary,
} from '@/lib/expenses/expenseQueries';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { monthInputValue } from '@/lib/expenses/types';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { expenses: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : monthInputValue();
  const [result, payroll] = await Promise.all([
    fetchMonthExpensesEnriched(rawMonth, auth.userId),
    listPayrollEmployees(),
  ]);

  if (!result.ok) {
    return res.status(result.status).json({
      message: result.message,
      code: result.code,
      detail: result.detail,
    });
  }

  if (payroll.error || !payroll.rows) {
    reportError(payroll.error ?? new Error('listPayrollEmployees failed'), {
      source: 'api/employees/expense-totals',
      month: rawMonth,
    });
  }

  const totals: Record<string, number> = {};
  const employees = payroll.rows ?? [];

  for (const employee of employees) {
    const expenses = filterExpensesForEmployee(result.expenses, employee.user_id);
    totals[employee.user_id] = totalEmployeeExpensesWithSalary(expenses, employee.salary);
  }

  // Include anyone who has expenses but may not be in the payroll list (shouldn't happen).
  for (const expense of result.expenses) {
    if (!expense.assigned_user_id || totals[expense.assigned_user_id] != null) {
      continue;
    }
    const expenses = filterExpensesForEmployee(result.expenses, expense.assigned_user_id);
    totals[expense.assigned_user_id] = totalEmployeeExpensesWithSalary(expenses, null);
  }

  return res.status(200).json({
    month: result.month,
    totals,
  });
}
