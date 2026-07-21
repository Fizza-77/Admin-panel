import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import { upsertPayrollBonus } from '@/lib/payroll/bonuses';
import { getPayrollDeductionForUser, netSalaryAfterDeduction } from '@/lib/payroll/deductions';
import { syncPayrollExpensesForMonth } from '@/lib/expenses/payrollExpenseSync';
import { monthInputValue } from '@/lib/expenses/types';
import { fetchAppProfileRow } from '@/lib/permissions/appProfileDb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { payroll: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const body = req.body ?? {};
  const rawAmount = body.amount;
  const amount =
    typeof rawAmount === 'number'
      ? rawAmount
      : typeof rawAmount === 'string'
        ? Number(rawAmount.replace(/,/g, '').trim())
        : NaN;

  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ message: 'Bonus amount must be a non-negative number' });
  }

  const { row: profile, error: profileError } = await fetchAppProfileRow(userId);
  if (profileError) {
    reportError(profileError, { source: 'api/payroll bonus profile', userId });
    return res.status(500).json({ message: 'Failed to load employee profile' });
  }

  const salary =
    profile?.salary != null && Number.isFinite(Number(profile.salary)) ? Number(profile.salary) : null;
  if (salary == null || salary <= 0) {
    return res.status(400).json({ message: 'Employee has no salary set on their profile' });
  }

  const notes = typeof body.notes === 'string' ? body.notes : null;
  const month =
    typeof body.month === 'string' ? body.month.trim() : monthInputValue();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'month must be YYYY-MM' });
  }

  const result = await upsertPayrollBonus({
    userId,
    amount,
    notes,
    createdBy: auth.userId,
    month,
  });

  if (!result.ok) {
    return res.status(result.status).json({ message: result.message });
  }

  await syncPayrollExpensesForMonth(month, auth.userId);

  const deduction = await getPayrollDeductionForUser(userId, month);
  const net_salary = netSalaryAfterDeduction(salary, deduction, result.amount);

  return res.status(200).json({
    success: true,
    user_id: userId,
    month,
    bonus: result.amount,
    deduction,
    base_salary: salary,
    net_salary,
  });
}
