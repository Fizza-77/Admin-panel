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

export const EXPENSE_CATEGORIES_REQUIRING_EMPLOYEE = [
  'Travel',
  'Software',
  'Payroll',
] as const;

export type ExpenseCategoryRequiringEmployee = (typeof EXPENSE_CATEGORIES_REQUIRING_EMPLOYEE)[number];

/** Travel / Software / Payroll require an employee; all other categories make it optional. */
export function categoryNeedsEmployee(category: string | null | undefined): category is ExpenseCategoryRequiringEmployee {
  if (!category) {
    return false;
  }
  return (EXPENSE_CATEGORIES_REQUIRING_EMPLOYEE as readonly string[]).includes(category);
}

/** @deprecated Use EXPENSE_CATEGORIES_REQUIRING_EMPLOYEE */
export const EXPENSE_CATEGORIES_WITH_EMPLOYEE = EXPENSE_CATEGORIES_REQUIRING_EMPLOYEE;
export type ExpenseCategoryWithEmployee = ExpenseCategoryRequiringEmployee;

/** Categories that also have dedicated auto-sync (salary / software subscriptions). */
export function isAutoSyncedExpenseCategory(category: string | null | undefined): boolean {
  return category === 'Payroll' || category === 'Software';
}

/** Any category can be marked fixed or one-time via the expense form toggle. */
export function categorySupportsFixedExpense(_category?: string | null): boolean {
  return true;
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
  is_fixed: boolean;
  fixed_expense_id: string | null;
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

/** Default day for a new expense in the given YYYY-MM month (today if that month is current). */
export function defaultExpenseDateForMonth(month: string): string {
  const range = monthDateRange(month);
  if (!range) {
    return new Date().toISOString().slice(0, 10);
  }
  const today = new Date();
  if (monthInputValue(today) === month.trim()) {
    return today.toISOString().slice(0, 10);
  }
  return range.from;
}

export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact PKR for stat circles (e.g. 150K, 1.2M). */
export function formatAmountShort(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const value = amount / 1_000_000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    return `${Math.round(amount / 1000)}K`;
  }
  if (abs >= 1000) {
    const value = amount / 1000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(Math.round(amount));
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
