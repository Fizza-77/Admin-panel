import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Trash2 } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import PageHeader from '@/components/ui/PageHeader';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmployeeSoftwarePanel from '@/components/expenses/EmployeeSoftwarePanel';
import { reportError } from '@/lib/monitoring';
import {
  EXPENSE_CATEGORIES,
  formatAmount,
  monthInputValue,
  type ExpenseListItem,
} from '@/lib/expenses/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type ExpenseFormState = {
  expense_date: string;
  title: string;
  amount: string;
  category: string;
  notes: string;
};

const emptyForm = (): ExpenseFormState => ({
  expense_date: new Date().toISOString().slice(0, 10),
  title: '',
  amount: '',
  category: 'Office',
  notes: '',
});

export const getServerSideProps = requireAuthentication(
  requirePermission({ expenses: true }, async () => ({ props: {} })),
);

function shiftMonth(month: string, delta: number): string {
  const [year, monthPart] = month.split('-').map(Number);
  const date = new Date(year, monthPart - 1 + delta, 1);
  return monthInputValue(date);
}

function creatorLabel(expense: ExpenseListItem): string {
  return expense.created_by_name?.trim() || expense.created_by_email || 'Unknown user';
}

export default function ExpensesPage({ permissions }: { permissions: AppPermissions }) {
  const [view, setView] = useState<'expenses' | 'software'>('expenses');
  const [month, setMonth] = useState(monthInputValue());
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const monthLabel = useMemo(() => {
    const [year, monthPart] = month.split('-').map(Number);
    return `${MONTH_NAMES[monthPart - 1]} ${year}`;
  }, [month]);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses?month=${encodeURIComponent(month)}`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load expenses');
      }
      setExpenses(Array.isArray(body?.expenses) ? body.expenses : []);
      setTotal(typeof body?.total === 'number' ? body.total : 0);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load expenses';
      setLoadError(msg);
      reportError(e, { source: 'ExpensesPage.load', month });
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (expense: ExpenseListItem) => {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date,
      title: expense.title,
      amount: String(expense.amount),
      category: expense.category || 'Other',
      notes: expense.notes || '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) {
      return;
    }
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        expense_date: form.expense_date,
        title: form.title.trim(),
        amount: form.amount,
        category: form.category || null,
        notes: form.notes.trim() || null,
      };

      const res = await fetch(editingId ? `/api/expenses/${editingId}` : '/api/expenses', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to save expense');
      }

      setFormOpen(false);
      setEditingId(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save expense';
      setFormError(msg);
      reportError(err, { source: 'ExpensesPage.submitForm', editingId });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to delete expense');
      }
      setDeleteTarget(null);
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete expense';
      alert(msg);
      reportError(err, { source: 'ExpensesPage.confirmDelete', expenseId: deleteTarget.id });
    } finally {
      setDeleting(false);
    }
  };

  const overlayMessages =
    saving ? ['Saving expense…', 'Updating records…', 'Almost done…']
    : deleting ? ['Deleting expense…', 'Updating totals…', 'Almost done…']
    : loading ? ['Loading expenses…', 'Calculating totals…', 'Almost ready…']
    : null;

  return (
    <AdminLayout permissions={permissions}>
      {overlayMessages && <LoadingOverlay messages={overlayMessages} rotateIntervalMs={3000} />}
      <Head>
        <title>Expense tracker - Skyen Admin</title>
      </Head>

      <PageHeader
        title="Expense tracker"
        description="Record monthly expenses and track which software each employee uses."
        actions={
          view === 'expenses' ? (
            <OutlineFillButtonAction type="button" onClick={openCreate} icon={<Plus className="h-[15px] w-[15px]" aria-hidden />}>
              Add expense
            </OutlineFillButtonAction>
          ) : null
        }
      />

      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
        <button
          type="button"
          onClick={() => setView('expenses')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            view === 'expenses' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Monthly expenses
        </button>
        <button
          type="button"
          onClick={() => setView('software')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            view === 'software' ? 'bg-cyan-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Software by employee
        </button>
      </div>

      {view === 'software' ? (
        <EmployeeSoftwarePanel />
      ) : (
        <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[180px] text-center">
            <p className="text-sm font-medium text-slate-500">Month</p>
            <p className="text-lg font-semibold text-slate-900">{monthLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, 1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-xl border border-cyan-100 bg-cyan-50 px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">Monthly total</p>
          <p className="text-2xl font-bold text-cyan-900">{formatAmount(total)}</p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{loadError}</div>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3 flex items-center gap-2">
            <Receipt className="h-5 w-5 text-cyan-600" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Expenses</h2>
            <span className="ml-auto text-sm text-slate-500">{expenses.length} record{expenses.length === 1 ? '' : 's'}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Added by</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Notes</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                      {format(new Date(`${expense.expense_date}T12:00:00`), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{expense.title}</td>
                    <td className="px-4 py-3 text-slate-600">{expense.category || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(expense.amount)}</td>
                    <td className="px-4 py-3 text-slate-600">{creatorLabel(expense)}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[220px] truncate">{expense.notes || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(expense)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(expense)}
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
            {expenses.length === 0 && !loading && (
              <p className="p-6 text-slate-500">No expenses recorded for {monthLabel}.</p>
            )}
          </div>
        </section>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit expense' : 'Add expense'}</h3>
            <form onSubmit={(e) => void submitForm(e)} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Date</span>
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Title</span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="e.g. Office supplies"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Amount (PKR)</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Category</span>
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {EXPENSE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Notes (optional)</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  maxLength={500}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Receipt details, vendor, etc."
                />
              </label>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <OutlineFillButtonAction type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}
                </OutlineFillButtonAction>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete expense?"
        description={
          deleteTarget
            ? `Remove "${deleteTarget.title}" (${formatAmount(deleteTarget.amount)}) from ${monthLabel}?`
            : ''
        }
        confirmLabel="Delete"
        loading={deleting}
        tone="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deleting) {
            setDeleteTarget(null);
          }
        }}
      />
        </>
      )}
    </AdminLayout>
  );
}
