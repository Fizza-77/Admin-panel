import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { employeeFullName, formatEmployeeSalary } from '@/lib/employees/profile';
import { getCurrentPayPeriod, getPayPeriodForMonth } from '@/lib/payroll/payPeriod';
import type { PayrollEmployeeRow, PayrollReceiptData } from '@/lib/payroll/types';

const COMPANY_NAME = 'Skyen Systems';
const LOGO_SIZE = 56;
const LOGO_TOP_OFFSET = 12;

function resolveCompanyLogoPath(): string | null {
  const root = process.cwd();
  for (const file of ['skyen-systems.png', 'logo.png']) {
    const fullPath = path.join(root, 'public', file);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function drawCompanyLogo(doc: PDFKit.PDFDocument, left: number, pageWidth: number, top: number): number {
  const logoPath = resolveCompanyLogoPath();
  if (!logoPath) {
    return 0;
  }

  const logoX = left + pageWidth - LOGO_SIZE;
  doc.image(logoPath, logoX, top, { fit: [LOGO_SIZE, LOGO_SIZE] });
  return LOGO_SIZE;
}

function shortEmployeeId(userId: string): string {
  return userId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildPayrollReceiptData(
  employee: PayrollEmployeeRow,
  monthOrNow?: string | Date,
): PayrollReceiptData {
  const period =
    typeof monthOrNow === 'string'
      ? getPayPeriodForMonth(monthOrNow) ?? getCurrentPayPeriod()
      : getCurrentPayPeriod(monthOrNow instanceof Date ? monthOrNow : undefined);
  const employeeName = employeeFullName(employee.display_name, employee.surname, employee.email);
  const deduction = (employee.deduction ?? 0) > 0 ? employee.deduction : 0;
  const bonus = (employee.bonus ?? 0) > 0 ? employee.bonus : 0;
  const netAmount = employee.net_salary ?? employee.salary;

  return {
    companyName: COMPANY_NAME,
    employeeName,
    employeeEmail: employee.email?.trim() || '—',
    employeeId: shortEmployeeId(employee.user_id),
    companyRole: employee.company_role?.trim() || null,
    contactInfo: employee.contact_info?.trim() || null,
    qualification: employee.qualification?.trim() || null,
    payPeriodLabel: period.payPeriodLabel,
    payMonthName: period.payMonthName,
    paymentDate: period.paymentDate,
    salaryAmount: employee.salary,
    salaryFormatted: formatEmployeeSalary(employee.salary),
    deductionAmount: deduction,
    deductionFormatted: formatEmployeeSalary(deduction > 0 ? deduction : null),
    bonusAmount: bonus,
    bonusFormatted: formatEmployeeSalary(bonus > 0 ? bonus : null),
    netAmount,
    netFormatted: formatEmployeeSalary(netAmount),
    referenceNumber: `PR-${period.payPeriodCode.replace('-', '')}-${shortEmployeeId(employee.user_id)}`,
  };
}

function drawLabelValue(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#64748b').text(label, x, y, { width });
  doc.font('Helvetica').fontSize(11).fillColor('#0f172a').text(value, x, y + 14, { width });
}

export function payrollReceiptFilename(data: PayrollReceiptData): string {
  const slug = data.employeeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const monthSlug = data.payMonthName.toLowerCase();
  return `payroll-receipt-${monthSlug}-${data.payPeriodLabel.split(' ')[1]}-${slug || 'employee'}.pdf`;
}

export function generatePayrollReceiptPdf(data: PayrollReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const headerTop = 50;
    const logoTop = headerTop - LOGO_TOP_OFFSET;

    const logoWidth = drawCompanyLogo(doc, left, pageWidth, logoTop);
    const headerTextWidth = logoWidth > 0 ? pageWidth - logoWidth - 12 : pageWidth;

    doc
      .font('Helvetica-Bold')
      .fontSize(22)
      .fillColor('#1e293b')
      .text(data.companyName, left, headerTop, { width: headerTextWidth });

    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#64748b')
      .text('Salary Payment Receipt', left, 78, { width: headerTextWidth });

    doc
      .roundedRect(left, 108, pageWidth, 54, 8)
      .fillAndStroke('#f8fafc', '#e2e8f0');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor('#475569')
      .text('SALARY MONTH PAID', left + 16, 122);

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#0f172a')
      .text(`${data.payMonthName} salary month paid`, left + 16, 138);

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Pay period: ${data.payPeriodLabel}`, left + pageWidth - 180, 122, { width: 164, align: 'right' });

    doc
      .text(`Payment date: ${data.paymentDate}`, left + pageWidth - 180, 138, { width: 164, align: 'right' });

    let y = 188;
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Employee details', left, y);
    y += 24;

    const colWidth = pageWidth / 2 - 8;
    drawLabelValue(doc, 'Employee name', data.employeeName, left, y, colWidth);
    drawLabelValue(doc, 'Employee ID', data.employeeId, left + colWidth + 16, y, colWidth);
    y += 44;
    drawLabelValue(doc, 'Email', data.employeeEmail, left, y, colWidth);
    drawLabelValue(doc, 'Role in company', data.companyRole || '—', left + colWidth + 16, y, colWidth);
    y += 44;
    drawLabelValue(doc, 'Qualification', data.qualification || '—', left, y, colWidth);
    drawLabelValue(doc, 'Contact', data.contactInfo || '—', left + colWidth + 16, y, colWidth);
    y += 56;

    const summaryTop = y;
    const summaryPad = 16;
    const amountColWidth = 104;
    const amountColX = left + pageWidth - summaryPad - amountColWidth;
    const descColWidth = pageWidth - summaryPad * 2 - amountColWidth - 12;

    let sy = summaryTop + summaryPad;
    const titleY = sy;
    sy += 24;
    const headersY = sy;
    sy += 16;
    const headerLineY = sy;
    sy += 12;
    const salaryRowY = sy;
    sy += 24;
    const hasDeduction = data.deductionAmount > 0;
    const hasBonus = data.bonusAmount > 0;
    const deductionRowY = hasDeduction ? sy : null;
    if (hasDeduction) {
      sy += 24;
    }
    const bonusRowY = hasBonus ? sy : null;
    if (hasBonus) {
      sy += 24;
    }
    const totalLineY = sy;
    sy += 12;
    const netRowY = sy;
    sy += 18;
    const summaryHeight = sy - summaryTop + summaryPad;

    doc
      .roundedRect(left, summaryTop, pageWidth, summaryHeight, 8)
      .fillAndStroke('#eff6ff', '#bfdbfe');

    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1e3a8a')
      .text('Payment summary', left + summaryPad, titleY);

    doc.font('Helvetica').fontSize(10).fillColor('#334155');
    doc.text('Description', left + summaryPad, headersY);
    doc.text('Amount (PKR)', amountColX, headersY, { width: amountColWidth, align: 'right' });

    doc
      .moveTo(left + summaryPad, headerLineY)
      .lineTo(left + pageWidth - summaryPad, headerLineY)
      .strokeColor('#cbd5e1')
      .stroke();

    doc.font('Helvetica').fontSize(11).fillColor('#0f172a');
    doc.text(`Monthly salary — ${data.payMonthName}`, left + summaryPad, salaryRowY, {
      width: descColWidth,
    });
    doc.text(data.salaryFormatted, amountColX, salaryRowY, { width: amountColWidth, align: 'right' });

    if (hasDeduction && deductionRowY != null) {
      doc.font('Helvetica').fontSize(11).fillColor('#b91c1c');
      doc.text('Salary deduction', left + summaryPad, deductionRowY, { width: descColWidth });
      doc.text(`- ${data.deductionFormatted}`, amountColX, deductionRowY, {
        width: amountColWidth,
        align: 'right',
      });
    }

    if (hasBonus && bonusRowY != null) {
      doc.font('Helvetica').fontSize(11).fillColor('#047857');
      doc.text('Bonus', left + summaryPad, bonusRowY, { width: descColWidth });
      doc.text(`+ ${data.bonusFormatted}`, amountColX, bonusRowY, {
        width: amountColWidth,
        align: 'right',
      });
    }

    doc
      .moveTo(left + summaryPad, totalLineY)
      .lineTo(left + pageWidth - summaryPad, totalLineY)
      .strokeColor('#cbd5e1')
      .stroke();

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a');
    doc.text('Net amount paid', left + summaryPad, netRowY);
    doc.text(data.netFormatted, amountColX, netRowY, { width: amountColWidth, align: 'right' });

    y = summaryTop + summaryHeight + 24;

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text(`Reference: ${data.referenceNumber}`, left, y);

    y += 40;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#94a3b8')
      .text(
        'This is a computer-generated salary receipt. Please retain it for your records. For payroll queries, contact your administrator.',
        left,
        y,
        { width: pageWidth },
      );

    doc.end();
  });
}
