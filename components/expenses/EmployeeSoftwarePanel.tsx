import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { reportError } from '@/lib/monitoring';
import { employeeFullName } from '@/lib/employees/profile';
import { formatAmount } from '@/lib/expenses/types';
import type { MoneyCurrency } from '@/lib/expenses/currency';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  type BillingCycle,
  type EmployeeSoftwareItem,
} from '@/lib/expenses/software';

type TeamUser = {
  id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  label: string;
};

type SoftwareFormState = {
  user_id: string;
  software_name: string;
  monthly_amount: string;
  amount_currency: MoneyCurrency;
  billing_cycle: BillingCycle;
  notes: string;
};

const emptyForm = (userId = ''): SoftwareFormState => ({
  user_id: userId,
  software_name: '',
  monthly_amount: '',
  amount_currency: 'PKR',
  billing_cycle: 'monthly',
  notes: '',
});

function amountLabel(cycle: BillingCycle): string {
  if (cycle === 'yearly') {
    return 'Yearly amount';
  }
  if (cycle === 'one_time') {
    return 'One-time cost';
  }
  return 'Monthly amount';
}

function priceLabel(item: EmployeeSoftwareItem): string {
  if (item.monthly_amount == null) {
    return '—';
  }
  const amount = formatAmount(item.monthly_amount);
  if (item.billing_cycle === 'yearly') {
    return `${amount}/yr`;
  }
  if (item.billing_cycle === 'one_time') {
    return amount;
  }
  return `${amount}/mo`;
}

export default function EmployeeSoftwarePanel({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<EmployeeSoftwareItem[]>([]);
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeSoftwareItem | null>(null);
  const [form, setForm] = useState<SoftwareFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeSoftwareItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const an = employeeFullName(a.employee_name, a.employee_surname, a.employee_email).toLowerCase();
      const bn = employeeFullName(b.employee_name, b.employee_surname, b.employee_email).toLowerCase();
      if (an !== bn) {
        return an.localeCompare(bn);
      }
      return a.software_name.localeCompare(b.software_name);
    });
  }, [items]);

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/expenses/software', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load software');
      }
      setItems(Array.isArray(body?.items) ? body.items : []);
      setTeamUsers(Array.isArray(body?.team_users) ? body.team_users : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load software';
      setLoadError(msg);
      reportError(e, { source: 'EmployeeSoftwarePanel.load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = (userId = '') => {
    setEditingItem(null);
    setForm(emptyForm(userId));
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: EmployeeSoftwareItem) => {
    setEditingItem(item);
    setForm({
      user_id: item.user_id,
      software_name: item.software_name,
      monthly_amount: item.monthly_amount != null ? String(item.monthly_amount) : '',
      amount_currency: 'PKR',
      billing_cycle: item.billing_cycle,
      notes: item.notes ?? '',
    });
    setFormError(null);
    setFormOpen(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload = {
        user_id: form.user_id,
        software_name: form.software_name.trim(),
        monthly_amount: form.monthly_amount.trim() || null,
        amount_currency: form.amount_currency,
        billing_cycle: form.billing_cycle,
        notes: form.notes.trim() || null,
      };

      const url = editingItem ? `/api/expenses/software/${editingItem.id}` : '/api/expenses/software';
      const method = editingItem ? 'PATCH' : 'POST';
      const body = editingItem
        ? {
            software_name: payload.software_name,
            monthly_amount: payload.monthly_amount,
            amount_currency: payload.amount_currency,
            billing_cycle: payload.billing_cycle,
            notes: payload.notes,
          }
        : payload;

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Failed to save');
      }

      setFormOpen(false);
      setEditingItem(null);
      await load();
      onChanged?.();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save');
      reportError(err, { source: 'EmployeeSoftwarePanel.submitForm' });
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
      const res = await fetch(`/api/expenses/software/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to delete');
      }
      setDeleteTarget(null);
      await load();
      onChanged?.();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
      reportError(err, { source: 'EmployeeSoftwarePanel.confirmDelete' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3 flex justify-end">
          <OutlineFillButtonAction
            type="button"
            onClick={() => openCreate()}
            icon={<Plus className="h-[15px] w-[15px]" aria-hidden />}
            className="!text-xs"
          >
            Add software
          </OutlineFillButtonAction>
        </div>

        {loadError ? (
          <p className="p-5 text-red-600">{loadError}</p>
        ) : loading ? (
          <p className="p-6 text-slate-500">Loading software assignments…</p>
        ) : sortedItems.length === 0 ? (
          <p className="p-6 text-slate-500">
            No software tracked yet. Add tools like Figma, Adobe, Cursor, or Jira for each employee.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-5 py-3 text-left font-semibold text-slate-700">Software</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-700">Amount</th>
                  <th className="px-5 py-3 text-right font-semibold text-slate-700 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedItems.map((item) => {
                  const employeeName = employeeFullName(
                    item.employee_name,
                    item.employee_surname,
                    item.employee_email,
                  );
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-slate-900">{employeeName}</td>
                      <td className="px-5 py-3 text-slate-700">{item.software_name}</td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900">{priceLabel(item)}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label={`Edit ${item.software_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                            aria-label={`Delete ${item.software_name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingItem ? 'Edit software' : 'Add software for employee'}
            </h3>
            <form onSubmit={(e) => void submitForm(e)} className="mt-4 space-y-4">
              {!editingItem && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Employee</span>
                  <select
                    required
                    value={form.user_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select employee…</option>
                    {teamUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                        {u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Software name</span>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={form.software_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, software_name: e.target.value }))}
                  placeholder="e.g. Figma, Adobe CC, Cursor"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Billing</span>
                  <select
                    value={form.billing_cycle}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, billing_cycle: e.target.value as BillingCycle }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {BILLING_CYCLES.map((cycle) => (
                      <option key={cycle} value={cycle}>
                        {BILLING_CYCLE_LABELS[cycle]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700">{amountLabel(form.billing_cycle)}</span>
                    <select
                      value={form.amount_currency}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, amount_currency: e.target.value as MoneyCurrency }))
                      }
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700"
                    >
                      <option value="PKR">PKR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monthly_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, monthly_amount: e.target.value }))}
                    placeholder="Optional"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Notes (optional)</span>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  maxLength={500}
                  placeholder="License type, seat count, etc."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    if (!saving) {
                      setFormOpen(false);
                      setEditingItem(null);
                    }
                  }}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <OutlineFillButtonAction type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editingItem ? 'Save changes' : 'Add software'}
                </OutlineFillButtonAction>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove software?"
        description={
          deleteTarget ? `Remove "${deleteTarget.software_name}" from this employee's software list?` : ''
        }
        confirmLabel="Remove"
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
  );
}
