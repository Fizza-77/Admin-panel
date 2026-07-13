import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import { sendPayrollReceiptEmail } from '@/lib/email/payrollReceiptEmail';
import { listPayrollEmployees } from '@/lib/payroll/listPayrollEmployees';
import { buildPayrollReceiptData, generatePayrollReceiptPdf } from '@/lib/payroll/receipt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { attendance: true });
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

  const { rows, error } = await listPayrollEmployees();
  if (error || !rows) {
    reportError(error ?? new Error('listPayrollEmployees failed'), { source: 'api/payroll send POST', userId });
    return res.status(500).json({ message: 'Failed to load employee' });
  }

  const employee = rows.find((row) => row.user_id === userId);
  if (!employee) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  const email = employee.email?.trim();
  if (!email) {
    return res.status(400).json({ message: 'This employee has no email address on file.' });
  }

  try {
    const receiptData = buildPayrollReceiptData(employee);
    const pdfBuffer = await generatePayrollReceiptPdf(receiptData);
    await sendPayrollReceiptEmail(email, receiptData, pdfBuffer);

    return res.status(200).json({
      ok: true,
      message: `Receipt sent to ${email}`,
      pay_month: receiptData.payMonthName,
      pay_period: receiptData.payPeriodLabel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send receipt';
    reportError(err, { source: 'api/payroll send', userId, email });
    return res.status(500).json({ message });
  }
}
