import type { AppProfileRow } from '@/lib/permissions/appProfileDb';

export type EmployeeProfile = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  surname: string | null;
  qualification: string | null;
  contact_info: string | null;
  company_role: string | null;
  salary: number | null;
  avatar_url: string | null;
};

export type EmployeePersonalInput = {
  display_name: string | null;
  surname: string | null;
  qualification: string | null;
  contact_info: string | null;
};

export type EmployeeAdminInput = {
  company_role: string | null;
  salary: number | null;
};

const MAX_SHORT = 120;
const MAX_CONTACT = 200;

export function trimProfileText(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLen);
}

export function parseSalaryInput(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) {
    return null;
  }
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) {
    return null;
  }
  return Math.round(num * 100) / 100;
}

export function employeeFullName(
  displayName: string | null | undefined,
  surname: string | null | undefined,
  email?: string | null,
): string {
  const first = displayName?.trim() ?? '';
  const last = surname?.trim() ?? '';
  const combined = [first, last].filter(Boolean).join(' ');
  if (combined) {
    return combined;
  }
  const mail = email?.trim();
  if (mail) {
    return mail;
  }
  return 'Employee';
}

export function formatEmployeeSalary(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function mapEmployeeProfile(
  userId: string,
  email: string | null | undefined,
  row: AppProfileRow | null | undefined,
): EmployeeProfile {
  return {
    user_id: userId,
    email: email?.trim() ?? null,
    display_name: row?.display_name ?? null,
    surname: row?.surname ?? null,
    qualification: row?.qualification ?? null,
    contact_info: row?.contact_info ?? null,
    company_role: row?.company_role ?? null,
    salary: row?.salary != null && Number.isFinite(Number(row.salary)) ? Number(row.salary) : null,
    avatar_url: row?.avatar_url ?? null,
  };
}

export function normalizePersonalInput(body: Record<string, unknown>): EmployeePersonalInput {
  return {
    display_name: trimProfileText(body.display_name, MAX_SHORT),
    surname: trimProfileText(body.surname, MAX_SHORT),
    qualification: trimProfileText(body.qualification, MAX_SHORT),
    contact_info: trimProfileText(body.contact_info, MAX_CONTACT),
  };
}

export function normalizeAdminInput(body: Record<string, unknown>): EmployeeAdminInput | { error: string } {
  const company_role = trimProfileText(body.company_role, MAX_SHORT);
  if (body.salary !== undefined && body.salary !== null && body.salary !== '') {
    const salary = parseSalaryInput(body.salary);
    if (salary === null) {
      return { error: 'Salary must be a non-negative number' };
    }
    return { company_role, salary };
  }
  return { company_role, salary: null };
}
