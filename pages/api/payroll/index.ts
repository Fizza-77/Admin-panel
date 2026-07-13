import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { getCurrentPayPeriod } from '@/lib/payroll/payPeriod';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { attendance: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { rows, error } = await listPayrollEmployees();
  if (error || !rows) {
    reportError(error ?? new Error('listPayrollEmployees failed'), { source: 'api/payroll GET' });
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to load payroll employees',
    });
  }

  const period = getCurrentPayPeriod();
  return res.status(200).json({
    pay_period: period,
    employees: rows,
  });
}
