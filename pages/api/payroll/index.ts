import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { getPayPeriodForMonth, parsePayrollMonthQuery } from '@/lib/payroll/payPeriod';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { payroll: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const month = parsePayrollMonthQuery(req.query.month);
  const period = getPayPeriodForMonth(month);
  if (!period) {
    return res.status(400).json({ message: 'Invalid month. Use YYYY-MM.' });
  }

  const { rows, error } = await listPayrollEmployees(month);
  if (error || !rows) {
    reportError(error ?? new Error('listPayrollEmployees failed'), { source: 'api/payroll GET', month });
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to load payroll employees',
    });
  }

  return res.status(200).json({
    month,
    pay_period: period,
    employees: rows,
  });
}
