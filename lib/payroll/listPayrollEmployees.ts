import { supabase } from '@/lib/supabase/server';
import { ensureAppProfileRowsForUserIds } from '@/lib/permissions/appProfileDb';
import type { PayrollEmployeeRow } from '@/lib/payroll/types';
import { loadPayrollDeductionsForMonth, netSalaryAfterDeduction } from '@/lib/payroll/deductions';
import { monthInputValue } from '@/lib/expenses/types';

async function listAllAuthUsers() {
  const users: Array<{ id: string; email?: string }> = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { users: null as null, error };
    }
    const batch = data?.users ?? [];
    for (const user of batch) {
      users.push({ id: user.id, email: user.email });
    }
    if (batch.length < perPage) {
      break;
    }
    page += 1;
    if (page > 200) {
      break;
    }
  }

  return { users, error: null };
}

export async function listPayrollEmployees(month = monthInputValue()): Promise<{
  rows: PayrollEmployeeRow[] | null;
  error: unknown;
}> {
  const { users, error: listError } = await listAllAuthUsers();
  if (listError || !users) {
    return { rows: null, error: listError ?? new Error('Failed to list users') };
  }

  const ids = users.map((user) => user.id);
  const [{ byUserId, error: profileError, stillMissingUserIds }, deductions] = await Promise.all([
    ensureAppProfileRowsForUserIds(ids),
    loadPayrollDeductionsForMonth(month),
  ]);
  if (profileError || stillMissingUserIds.length > 0) {
    return {
      rows: null,
      error: profileError ?? new Error('Failed to load user profiles'),
    };
  }

  const rows: PayrollEmployeeRow[] = users.map((user) => {
    const profile = byUserId.get(user.id);
    const salaryRaw = profile?.salary;
    const salary =
      salaryRaw != null && Number.isFinite(Number(salaryRaw)) ? Number(salaryRaw) : null;
    const hasSalary = salary != null && salary > 0;
    // Deductions only apply while a profile salary is set.
    const deduction = hasSalary ? deductions.get(user.id) ?? 0 : 0;
    const net_salary = netSalaryAfterDeduction(salary, deduction);

    return {
      user_id: user.id,
      email: user.email ?? null,
      display_name: profile?.display_name ?? null,
      surname: profile?.surname ?? null,
      company_role: profile?.company_role ?? null,
      salary,
      deduction,
      net_salary,
      avatar_url: profile?.avatar_url ?? null,
      contact_info: profile?.contact_info ?? null,
      qualification: profile?.qualification ?? null,
    };
  });

  rows.sort((a, b) => {
    const nameA = [a.display_name, a.surname].filter(Boolean).join(' ') || a.email || '';
    const nameB = [b.display_name, b.surname].filter(Boolean).join(' ') || b.email || '';
    return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
  });

  return { rows, error: null };
}
