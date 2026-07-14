import { format } from 'date-fns';
import { Pencil, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import StatCircle from '@/components/attendance/StatCircle';
import { employeeFullName } from '@/lib/employees/profile';
import {
  formatCompactCurrencyAmount,
  formatDisplayAmount,
  getCurrencySymbol,
  type MoneyCurrency,
} from '@/lib/expenses/currency';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseListItem,
} from '@/lib/expenses/types';

export type ExpenseCategoryFilter = 'all' | ExpenseCategory;

type TeamUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  label: string;
};

type CategorySummary = {
  key: ExpenseCategoryFilter;
  label: string;
  amount: number;
  count: number;
  accent: 'green' | 'red' | 'yellow' | 'blue' | 'slate' | 'cyan';
};

const CIRCLE_ORDER: ExpenseCategoryFilter[] = [
  'all',
  'Payroll',
  'Software',
  'Marketing',
  ...EXPENSE_CATEGORIES.filter((category) => !['Payroll', 'Software', 'Marketing'].includes(category)),
];

const CATEGORY_ACCENTS: Record<ExpenseCategoryFilter, CategorySummary['accent']> = {
  all: 'cyan',
  Payroll: 'blue',
  Software: 'green',
  Marketing: 'yellow',
  Office: 'slate',
  Travel: 'green',
  Utilities: 'red',
  Equipment: 'blue',
  Other: 'slate',
};

function normalizeCategory(category: string | null | undefined): ExpenseCategory {
  if (category && (EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return category as ExpenseCategory;
  }
  return 'Other';
}

function employeeLabel(expense: ExpenseListItem, teamUsers: TeamUser[]): string {
  if (!expense.assigned_user_id) {
    return '—';
  }
  const name = employeeFullName(
    expense.assigned_user_name,
    expense.assigned_user_surname,
    expense.assigned_user_email,
  );
  if (name) {
    return name;
  }
  const teamUser = teamUsers.find((user) => user.id === expense.assigned_user_id);
  return teamUser?.label || '—';
}

function buildSummaries(expenses: ExpenseListItem[], total: number): CategorySummary[] {
  const amounts = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const category of EXPENSE_CATEGORIES) {
    amounts.set(category, { amount: 0, count: 0 });
  }

  for (const expense of expenses) {
    const category = normalizeCategory(expense.category);
    const entry = amounts.get(category)!;
    entry.amount += expense.amount;
    entry.count += 1;
  }

  return CIRCLE_ORDER.map((key) => {
    if (key === 'all') {
      return {
        key,
        label: 'All',
        amount: total,
        count: expenses.length,
        accent: CATEGORY_ACCENTS.all,
      };
    }
    const entry = amounts.get(key)!;
    return {
      key,
      label: key,
      amount: entry.amount,
      count: entry.count,
      accent: CATEGORY_ACCENTS[key],
    };
  });
}

type ExpenseCategoryReportsProps = {
  expenses: ExpenseListItem[];
  total: number;
  teamUsers: TeamUser[];
  loading: boolean;
  displayCurrency: MoneyCurrency;
  selectedCategory: ExpenseCategoryFilter | null;
  onSelectCategory: (category: ExpenseCategoryFilter | null) => void;
  onEdit: (expense: ExpenseListItem) => void;
  onDelete: (expense: ExpenseListItem) => void;
};

export default function ExpenseCategoryReports({
  expenses,
  total,
  teamUsers,
  loading,
  displayCurrency,
  selectedCategory,
  onSelectCategory,
  onEdit,
  onDelete,
}: ExpenseCategoryReportsProps) {
  const summaries = buildSummaries(expenses, total);

  const filteredExpenses =
    selectedCategory === null
      ? []
      : selectedCategory === 'all'
        ? expenses
        : expenses.filter((expense) => normalizeCategory(expense.category) === selectedCategory);

  const selectedLabel =
    selectedCategory === null ? null : selectedCategory === 'all' ? 'All categories' : selectedCategory;

  useEffect(() => {
    if (selectedCategory === null) {
      return;
    }
    const count =
      selectedCategory === 'all'
        ? expenses.length
        : summaries.find((summary) => summary.key === selectedCategory)?.count ?? 0;
    if (count === 0) {
      onSelectCategory(null);
    }
  }, [selectedCategory, expenses.length, summaries, onSelectCategory]);

  return (
    <div className="space-y-6">
      <section className="att-report-section" aria-label="Expense categories">
        <div className="att-report-circles">
          {summaries.map((summary) => {
            const percent = total > 0 ? Math.round((summary.amount / total) * 100) : 0;
            const selected = selectedCategory === summary.key;
            const hasExpenses = summary.count > 0;
            return (
              <button
                key={summary.key}
                type="button"
                disabled={!hasExpenses}
                onClick={() => {
                  if (!hasExpenses) {
                    return;
                  }
                  onSelectCategory(selected ? null : summary.key);
                }}
                className={`rounded-xl p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                  selected
                    ? 'bg-cyan-50 ring-2 ring-cyan-500'
                    : hasExpenses
                      ? 'hover:bg-slate-50'
                      : 'cursor-default opacity-60'
                }`}
                aria-pressed={selected && hasExpenses}
                aria-label={`${summary.label}: ${formatDisplayAmount(summary.amount, displayCurrency)}, ${summary.count} items`}
              >
                <StatCircle
                  label={summary.label}
                  value={formatCompactCurrencyAmount(summary.amount, displayCurrency)}
                  currencySymbol={getCurrencySymbol(displayCurrency)}
                  sublabel={`${summary.count} item${summary.count === 1 ? '' : 's'} · ${percent}%`}
                  percent={percent}
                  accent={summary.accent}
                />
              </button>
            );
          })}
        </div>
        {selectedCategory === null && !loading && (
          <p className="mt-4 text-center text-sm text-slate-500">
            Select a category above to view its expense list.
          </p>
        )}
      </section>

      {selectedCategory !== null && filteredExpenses.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{selectedLabel}</h3>
            <span className="text-sm text-slate-500">
              {filteredExpenses.length} record{filteredExpenses.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => onSelectCategory(null)}
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
              aria-label="Close list"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                  {selectedCategory === 'all' && (
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {format(new Date(`${expense.expense_date}T12:00:00`), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <span>{expense.title}</span>
                        {(expense.is_fixed || expense.fixed_expense_id) && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                            Fixed
                          </span>
                        )}
                      </span>
                    </td>
                    {selectedCategory === 'all' && (
                      <td className="px-4 py-3 text-slate-600">{expense.category || '—'}</td>
                    )}
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {formatDisplayAmount(expense.amount, displayCurrency)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employeeLabel(expense, teamUsers)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{expense.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(expense)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(expense)}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
