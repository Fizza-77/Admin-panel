import { format, lastDayOfMonth } from 'date-fns';
import { monthDateRange } from '@/lib/expenses/types';

export type PayPeriod = {
  payPeriodLabel: string;
  payMonthName: string;
  paymentDate: string;
  payPeriodCode: string;
  year: number;
};

function periodFromDate(date: Date, paymentDate: Date): PayPeriod {
  return {
    payPeriodLabel: format(date, 'MMMM yyyy'),
    payMonthName: format(date, 'MMMM'),
    paymentDate: format(paymentDate, 'd MMMM yyyy'),
    payPeriodCode: format(date, 'yyyy-MM'),
    year: date.getFullYear(),
  };
}

export function getCurrentPayPeriod(now = new Date()): PayPeriod {
  return periodFromDate(now, now);
}

/** Pay period for a YYYY-MM month (payment date = last day of that month, or today if current month). */
export function getPayPeriodForMonth(month: string, now = new Date()): PayPeriod | null {
  const range = monthDateRange(month.trim());
  if (!range) {
    return null;
  }
  const [year, monthPart] = month.split('-').map(Number);
  const monthDate = new Date(year, monthPart - 1, 1);
  const currentCode = format(now, 'yyyy-MM');
  const paymentDate =
    month.trim() === currentCode ? now : lastDayOfMonth(monthDate);
  return periodFromDate(monthDate, paymentDate);
}

export function parsePayrollMonthQuery(raw: unknown): string {
  if (typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw.trim())) {
    return raw.trim();
  }
  return format(new Date(), 'yyyy-MM');
}
