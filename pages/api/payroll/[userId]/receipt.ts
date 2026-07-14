import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { buildPayrollReceiptData, generatePayrollReceiptPdf, payrollReceiptFilename } from '@/lib/payroll/receipt';
import { parsePayrollMonthQuery } from '@/lib/payroll/payPeriod';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { attendance: true });
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

  const month = parsePayrollMonthQuery(req.query.month);
  const { rows, error } = await listPayrollEmployees(month);
  if (error || !rows) {
    reportError(error ?? new Error('listPayrollEmployees failed'), { source: 'api/payroll receipt GET', userId, month });
    return res.status(500).json({ message: 'Failed to load employee' });
  }

  const employee = rows.find((row) => row.user_id === userId);
  if (!employee) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  try {
    const receiptData = buildPayrollReceiptData(employee, month);
    const pdfBuffer = await generatePayrollReceiptPdf(receiptData);
    const filename = payrollReceiptFilename(receiptData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    reportError(err, { source: 'api/payroll receipt PDF', userId, month });
    return res.status(500).json({ message: 'Failed to generate receipt' });
  }
}
