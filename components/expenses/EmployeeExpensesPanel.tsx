import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import ExpenseFormModal from '@/components/expenses/ExpenseFormModal';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { reportError } from '@/lib/monitoring';
import { formatAmount, type ExpenseListItem } from '@/lib/expenses/types';

type EmployeeExpensesPanelProps = {
  userId: string;
  month: string;
  monthLabel: string;
  employeeName: string;
  onTotalChange?: (total: number) => void;
};

export default function EmployeeExpensesPanel({
  userId,
  month,
  monthLabel,
  employeeName,
  onTotalChange,
}: EmployeeExpensesPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/employees/${encodeURIComponent(userId)}/expenses?month=${encodeURIComponent(month)}`,
        { credentials: 'include' },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load employee expenses');
      }
      const rows = Array.isArray(body?.expenses) ? (body.expenses as ExpenseListItem[]) : [];
      const nextTotal = typeof body?.total === 'number' ? body.total : 0;
      setExpenses(rows);
      setTotal(nextTotal);
      onTotalChange?.(nextTotal);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load employee expenses';
      setLoadError(msg);
      reportError(e, { source: 'EmployeeExpensesPanel.load', userId, month });
    } finally {
      setLoading(false);
    }
  }, [userId, month, onTotalChange]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
          <p className="text-sm text-slate-500">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-cyan-700">Total</p>
            <p className="text-lg font-bold text-cyan-900">{formatAmount(total)}</p>
          </div>
          <OutlineFillButtonAction
            type="button"
            onClick={() => setFormOpen(true)}
            icon={<Plus className="h-[15px] w-[15px]" aria-hidden />}
          >
            Add expense
          </OutlineFillButtonAction>
        </div>
      </div>

      {loadError ? (
        <p className="p-5 text-red-600">{loadError}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((expense) => (
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
                  <td className="px-4 py-3 text-slate-600">{expense.category || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(expense.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{expense.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && expenses.length === 0 && (
            <p className="p-6 text-slate-500">No expenses linked to {employeeName} for {monthLabel}.</p>
          )}
        </div>
      )}

      <ExpenseFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load()}
        teamUsers={[]}
        lockedAssigneeId={userId}
        lockedAssigneeLabel={employeeName}
        defaultCategory="Equipment"
        defaultMonth={month}
      />
    </section>
  );
}
