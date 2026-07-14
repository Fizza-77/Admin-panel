import Head from 'next/head';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import { LoadingOverlay } from '@/components/ui/Spinner';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ExpenseCategoryReports, {
  type ExpenseCategoryFilter,
} from '@/components/expenses/ExpenseCategoryReports';
import { reportError } from '@/lib/monitoring';
import { EXPENSE_MONEY_CURRENCIES, getExchangeRateToPkr, type MoneyCurrency } from '@/lib/expenses/currency';
import {
  EXPENSE_CATEGORIES,
  categoryNeedsEmployee,
  defaultExpenseDateForMonth,
  formatAmount,
  monthInputValue,
  type ExpenseListItem,
} from '@/lib/expenses/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type TeamUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  label: string;
};

type ExpenseFormState = {
  expense_date: string;
  title: string;
  amount: string;
  amount_currency: MoneyCurrency;
  category: string;
  assigned_user_id: string;
  notes: string;
  is_fixed: boolean;
};

const emptyForm = (month?: string): ExpenseFormState => ({
  expense_date: month ? defaultExpenseDateForMonth(month) : new Date().toISOString().slice(0, 10),
  title: '',
  amount: '',
  amount_currency: 'PKR',
  category: 'Office',
  assigned_user_id: '',
  notes: '',
  is_fixed: false,
});

export const getServerSideProps = requireAuthentication(
  requirePermission({ expenses: true }, async () => ({ props: {} })),
);

function shiftMonth(month: string, delta: number): string {
  const [year, monthPart] = month.split('-').map(Number);
  const date = new Date(year, monthPart - 1 + delta, 1);
  return monthInputValue(date);
}

export default function ExpensesPage({ permissions }: { permissions: AppPermissions }) {
  const [month, setMonth] = useState(monthInputValue());
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
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
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategoryFilter | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<MoneyCurrency>('PKR');

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
      setTeamUsers(Array.isArray(body?.team_users) ? body.team_users : []);
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

  useEffect(() => {
    setSelectedCategory(null);
  }, [month]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(month));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (expense: ExpenseListItem) => {
    setEditingId(expense.id);
    setForm({
      expense_date: expense.expense_date,
      title: expense.title,
      amount: String(expense.amount),
      amount_currency: 'PKR',
      category: expense.category || 'Other',
      assigned_user_id: expense.assigned_user_id || '',
      notes: expense.notes || '',
      is_fixed: expense.is_fixed || Boolean(expense.fixed_expense_id),
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
        amount_currency: form.amount_currency,
        category: form.category || null,
        assigned_user_id: form.assigned_user_id || null,
        notes: form.notes.trim() || null,
        is_fixed: form.is_fixed,
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

      <div className="mb-6 grid grid-cols-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-[1fr_auto_1fr] sm:gap-4">
        <div className="flex justify-center sm:justify-start">
          <label className="flex flex-col items-start gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Currency</span>
            <select
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value as MoneyCurrency)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
              title={
                displayCurrency === 'PKR'
                  ? 'Amounts stored in PKR'
                  : `1 ${displayCurrency} = ${getExchangeRateToPkr(displayCurrency).toLocaleString()} PKR`
              }
            >
              {EXPENSE_MONEY_CURRENCIES.map((currency) => (
                <option key={currency.value} value={currency.value}>
                  {currency.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((current) => shiftMonth(current, -1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-[180px] text-center">
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
        <div className="flex justify-center sm:justify-end">
          <OutlineFillButtonAction
            type="button"
            onClick={openCreate}
            icon={<Plus className="h-[15px] w-[15px]" aria-hidden />}
          >
            Add expense
          </OutlineFillButtonAction>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{loadError}</div>
      ) : (
        <ExpenseCategoryReports
          expenses={expenses}
          total={total}
          teamUsers={teamUsers}
          loading={loading}
          displayCurrency={displayCurrency}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onEdit={openEdit}
          onDelete={setDeleteTarget}
        />
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
                <span className="text-xs font-medium text-slate-700">
                  {form.category === 'Software' ? 'Software name' : 'Title'}
                </span>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder={form.category === 'Software' ? 'e.g. Figma, Adobe CC, Cursor' : 'e.g. Office supplies'}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">Amount</span>
                    <select
                      value={form.amount_currency}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, amount_currency: e.target.value as MoneyCurrency }))
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      {EXPENSE_MONEY_CURRENCIES.map((currency) => (
                        <option key={currency.value} value={currency.value}>
                          {currency.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
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
                <span className="text-xs font-medium text-slate-700">
                  Employee{categoryNeedsEmployee(form.category) ? '' : ' (optional)'}
                </span>
                <select
                  required={categoryNeedsEmployee(form.category)}
                  value={form.assigned_user_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, assigned_user_id: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">
                    {categoryNeedsEmployee(form.category) ? 'Select employee…' : 'No employee'}
                  </option>
                  {teamUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.label}
                      {user.email ? ` (${user.email})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-medium text-slate-900">Fixed Expense</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_fixed}
                      aria-label="Fixed Expense"
                      onClick={() => setForm((prev) => ({ ...prev, is_fixed: !prev.is_fixed }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${
                        form.is_fixed ? 'bg-cyan-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                          form.is_fixed ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
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
            ? deleteTarget.category === 'Payroll'
              ? `Remove "${deleteTarget.title}" payroll from ${monthLabel} only? Their profile salary is not changed and will still appear in other months.`
              : deleteTarget.is_fixed || deleteTarget.fixed_expense_id
              ? `Remove "${deleteTarget.title}" (${formatAmount(deleteTarget.amount)}) from ${monthLabel} only? It will stay in other months.`
              : deleteTarget.category === 'Software' || deleteTarget.employee_software_id
                ? `Remove "${deleteTarget.title}" (${formatAmount(deleteTarget.amount)})? This also removes the linked software subscription.`
                : `Remove "${deleteTarget.title}" (${formatAmount(deleteTarget.amount)}) from ${monthLabel}?`
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
    </AdminLayout>
  );
}
