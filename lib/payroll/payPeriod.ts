import { format } from 'date-fns';

export type PayPeriod = {
  payPeriodLabel: string;
  payMonthName: string;
  paymentDate: string;
  payPeriodCode: string;
  year: number;
};

export function getCurrentPayPeriod(now = new Date()): PayPeriod {
  return {
    payPeriodLabel: format(now, 'MMMM yyyy'),
    payMonthName: format(now, 'MMMM'),
    paymentDate: format(now, 'd MMMM yyyy'),
    payPeriodCode: format(now, 'yyyy-MM'),
    year: now.getFullYear(),
  };
}
