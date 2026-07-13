import { sendMail } from '@/lib/email/mailer';
import { isSmtpConfigured } from '@/lib/email/smtpConfig';
import { reportError } from '@/lib/monitoring';
import type { PayrollReceiptData } from '@/lib/payroll/types';
import { payrollReceiptFilename } from '@/lib/payroll/receipt';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailContent(data: PayrollReceiptData) {
  const subject = `Salary receipt — ${data.payMonthName} ${data.payPeriodLabel.split(' ')[1] ?? ''}`.trim();

  const text = [
    `Hi ${data.employeeName},`,
    '',
    `Please find attached your salary receipt for ${data.payMonthName} (${data.payPeriodLabel}).`,
    '',
    `Role: ${data.companyRole || '—'}`,
    `Net amount paid: ${data.salaryFormatted}`,
    `Payment date: ${data.paymentDate}`,
    `Reference: ${data.referenceNumber}`,
    '',
    '— Skyen Systems',
  ].join('\n');

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;max-width:560px;">
      <p>Hi ${escapeHtml(data.employeeName)},</p>
      <p>Please find attached your salary receipt for <strong>${escapeHtml(data.payMonthName)}</strong> (${escapeHtml(data.payPeriodLabel)}).</p>
      <p style="margin:20px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">${escapeHtml(data.payMonthName)} salary month paid</strong>
        <span style="display:block;margin-top:8px;font-size:15px;">Net amount: <strong>${escapeHtml(data.salaryFormatted)}</strong></span>
        <span style="display:block;margin-top:4px;font-size:13px;color:#64748b;">Role: ${escapeHtml(data.companyRole || '—')}</span>
        <span style="display:block;margin-top:4px;font-size:13px;color:#64748b;">Payment date: ${escapeHtml(data.paymentDate)}</span>
      </p>
      <p style="font-size:12px;color:#94a3b8;">Skyen Systems</p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendPayrollReceiptEmail(
  to: string,
  data: PayrollReceiptData,
  pdfBuffer: Buffer,
): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
  }

  const { subject, text, html } = buildEmailContent(data);
  const filename = payrollReceiptFilename(data);

  try {
    await sendMail({
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (error) {
    reportError(error, { source: 'sendPayrollReceiptEmail', to, reference: data.referenceNumber });
    throw error;
  }
}
