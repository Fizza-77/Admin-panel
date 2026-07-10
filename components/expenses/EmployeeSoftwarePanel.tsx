import { useCallback, useEffect, useState } from 'react';
import { Monitor, Pencil, Plus, Trash2 } from 'lucide-react';
import { OutlineFillButtonAction } from '@/components/ui/OutlineFillButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { reportError } from '@/lib/monitoring';
import { employeeFullName } from '@/lib/employees/profile';
import { formatAmount } from '@/lib/expenses/types';
import {
  BILLING_CYCLES,
  BILLING_CYCLE_LABELS,
  type BillingCycle,
  type EmployeeSoftwareGroup,
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
  billing_cycle: BillingCycle;
  notes: string;
};

const emptyForm = (userId = ''): SoftwareFormState => ({
  user_id: userId,
  software_name: '',
  monthly_amount: '',
  billing_cycle: 'monthly',
  notes: '',
});

function amountLabel(cycle: BillingCycle): string {
  if (cycle === 'yearly') {
    return 'Yearly amount (PKR)';
  }
  if (cycle === 'one_time') {
    return 'One-time cost (PKR)';
  }
  return 'Monthly amount (PKR)';
}

export default function EmployeeSoftwarePanel() {
  const [groups, setGroups] = useState<EmployeeSoftwareGroup[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
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

  const load = useCallback(async () => {
    setLoadError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/expenses/software', { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Failed to load software');
      }
      setGroups(Array.isArray(body?.groups) ? body.groups : []);
      setMonthlyTotal(typeof body?.monthly_total === 'number' ? body.monthly_total : 0);
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
        billing_cycle: form.billing_cycle,
        notes: form.notes.trim() || null,
      };

      const url = editingItem ? `/api/expenses/software/${editingItem.id}` : '/api/expenses/software';
      const method = editingItem ? 'PATCH' : 'POST';
      const body = editingItem
        ? {
            software_name: payload.software_name,
            monthly_amount: payload.monthly_amount,
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
        <div className="border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-cyan-600" aria-hidden />
            <h2 className="text-lg font-semibold text-slate-900">Software by employee</h2>
          </div>
          <span className="text-sm text-slate-500">Track which tools each person uses</span>
          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-lg border border-violet-100 bg-violet-50 px-3 py-1.5 text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-violet-700">Est. monthly software</p>
              <p className="text-sm font-bold text-violet-900">{formatAmount(monthlyTotal)}</p>
            </div>
            <OutlineFillButtonAction
              type="button"
              onClick={() => openCreate()}
              icon={<Plus className="h-[15px] w-[15px]" aria-hidden />}
              className="!text-xs"
            >
              Add software
            </OutlineFillButtonAction>
          </div>
        </div>

        {loadError ? (
          <p className="p-5 text-red-600">{loadError}</p>
        ) : loading ? (
          <p className="p-6 text-slate-500">Loading software assignments…</p>
        ) : groups.length === 0 ? (
          <p className="p-6 text-slate-500">
            No software tracked yet. Add tools like Figma, Adobe, Cursor, or Jira for each employee.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {groups.map((group) => {
              const name = employeeFullName(group.employee_name, group.employee_surname, group.employee_email);
              return (
                <div key={group.user_id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">{name}</h3>
                      <p className="text-xs text-slate-500">{group.employee_email ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">
                        {formatAmount(group.monthly_total)}/mo est.
                      </span>
                      <button
                        type="button"
                        onClick={() => openCreate(group.user_id)}
                        className="text-xs font-medium text-cyan-700 hover:text-cyan-800"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {group.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{item.software_name}</p>
                          <p className="text-xs text-slate-500">
                            {BILLING_CYCLE_LABELS[item.billing_cycle]}
                            {item.monthly_amount != null ? ` · ${formatAmount(item.monthly_amount)}` : ''}
                            {item.notes ? ` · ${item.notes}` : ''}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
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
                  <span className="text-xs font-medium text-slate-700">{amountLabel(form.billing_cycle)}</span>
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
