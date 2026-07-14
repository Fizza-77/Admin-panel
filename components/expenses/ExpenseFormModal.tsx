import { useEffect, useState } from 'react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import { reportError } from '@/lib/monitoring';
import { EXPENSE_MONEY_CURRENCIES, type MoneyCurrency } from '@/lib/expenses/currency';
import {
  EXPENSE_CATEGORIES,
  categoryNeedsEmployee,
  defaultExpenseDateForMonth,
  type ExpenseListItem,
} from '@/lib/expenses/types';

export type ExpenseTeamUser = {
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

type ExpenseFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  teamUsers: ExpenseTeamUser[];
  editingExpense?: ExpenseListItem | null;
  lockedAssigneeId?: string;
  lockedAssigneeLabel?: string;
  defaultCategory?: string;
  /** YYYY-MM — defaults the date field to this month when creating. */
  defaultMonth?: string;
};

function emptyForm(
  lockedAssigneeId?: string,
  defaultCategory = 'Office',
  defaultMonth?: string,
): ExpenseFormState {
  return {
    expense_date: defaultMonth
      ? defaultExpenseDateForMonth(defaultMonth)
      : new Date().toISOString().slice(0, 10),
    title: '',
    amount: '',
    amount_currency: 'PKR',
    category: defaultCategory,
    assigned_user_id: lockedAssigneeId ?? '',
    notes: '',
    is_fixed: false,
  };
}

export default function ExpenseFormModal({
  open,
  onClose,
  onSaved,
  teamUsers,
  editingExpense = null,
  lockedAssigneeId,
  lockedAssigneeLabel,
  defaultCategory = 'Office',
  defaultMonth,
}: ExpenseFormModalProps) {
  const [form, setForm] = useState<ExpenseFormState>(() =>
    emptyForm(lockedAssigneeId, defaultCategory, defaultMonth),
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setFormError(null);
    if (editingExpense) {
      setForm({
        expense_date: editingExpense.expense_date,
        title: editingExpense.title,
        amount: String(editingExpense.amount),
        amount_currency: 'PKR',
        category: editingExpense.category || 'Other',
        assigned_user_id: editingExpense.assigned_user_id || lockedAssigneeId || '',
        notes: editingExpense.notes || '',
        is_fixed: editingExpense.is_fixed || Boolean(editingExpense.fixed_expense_id),
      });
      return;
    }
    setForm(emptyForm(lockedAssigneeId, defaultCategory, defaultMonth));
  }, [open, editingExpense, lockedAssigneeId, defaultCategory, defaultMonth]);

  if (!open) {
    return null;
  }

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const assigneeId = lockedAssigneeId
        ? lockedAssigneeId
        : form.assigned_user_id || null;
      const payload = {
        expense_date: form.expense_date,
        title: form.title.trim(),
        amount: form.amount,
        amount_currency: form.amount_currency,
        category: form.category || null,
        assigned_user_id: assigneeId,
        notes: form.notes.trim() || null,
        is_fixed: form.is_fixed,
        link_to_employee: Boolean(lockedAssigneeId),
      };

      const res = await fetch(editingExpense ? `/api/expenses/${editingExpense.id}` : '/api/expenses', {
        method: editingExpense ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to save expense');
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save expense';
      setFormError(msg);
      reportError(err, { source: 'ExpenseFormModal.submit', editingId: editingExpense?.id });
    } finally {
      setSaving(false);
    }
  };

  const showEmployeeSelect = !lockedAssigneeId;
  const showLockedAssignee = Boolean(lockedAssigneeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">
          {editingExpense ? 'Edit expense' : 'Add expense'}
        </h3>
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
                    assigned_user_id: lockedAssigneeId ? lockedAssigneeId : prev.assigned_user_id,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {EXPENSE_CATEGORIES.filter((category) => !lockedAssigneeId || category !== 'Payroll').map(
                  (category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          {showLockedAssignee && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{lockedAssigneeLabel || '—'}</p>
            </div>
          )}
          {showEmployeeSelect && (
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
          )}
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
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <OutlineFillButtonAction type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingExpense ? 'Save changes' : 'Add expense'}
            </OutlineFillButtonAction>
          </div>
        </form>
      </div>
    </div>
  );
}
