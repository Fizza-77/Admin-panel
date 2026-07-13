export const EXPENSE_CATEGORIES = [
  'Office',
  'Travel',
  'Software',
  'Marketing',
  'Payroll',
  'Utilities',
  'Equipment',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORIES_WITH_EMPLOYEE = [
  'Software',
  'Payroll',
  'Equipment',
  'Marketing',
] as const;

export type ExpenseCategoryWithEmployee = (typeof EXPENSE_CATEGORIES_WITH_EMPLOYEE)[number];

export function categoryNeedsEmployee(category: string | null | undefined): category is ExpenseCategoryWithEmployee {
  if (!category) {
    return false;
  }
  return (EXPENSE_CATEGORIES_WITH_EMPLOYEE as readonly string[]).includes(category);
}

export type ExpenseRow = {
  id: string;
  expense_date: string;
  title: string;
  amount: number;
  category: string | null;
  notes: string | null;
  created_by: string;
  assigned_user_id: string | null;
  employee_software_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ExpenseListItem = ExpenseRow & {
  created_by_name: string | null;
  created_by_email: string | null;
  assigned_user_name: string | null;
  assigned_user_surname: string | null;
  assigned_user_email: string | null;
};

export function monthInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function monthDateRange(month: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]);
  if (monthIndex < 1 || monthIndex > 12) {
    return null;
  }
  const from = `${match[1]}-${match[2]}-01`;
  const lastDay = new Date(year, monthIndex, 0).getDate();
  const to = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function parseAmountInput(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

/** Allows zero — for software subscriptions that are free. */
export function parseNonNegativeAmountInput(value: string): number | null {
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}
