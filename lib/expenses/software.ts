export const BILLING_CYCLES = ['monthly', 'yearly', 'one_time'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Monthly',
  yearly: 'Yearly',
  one_time: 'One-time',
};

export type EmployeeSoftwareRow = {
  id: string;
  user_id: string;
  software_name: string;
  monthly_amount: number | null;
  billing_cycle: BillingCycle;
  notes: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type EmployeeSoftwareItem = EmployeeSoftwareRow & {
  employee_name: string | null;
  employee_surname: string | null;
  employee_email: string | null;
};

export type EmployeeSoftwareGroup = {
  user_id: string;
  employee_name: string | null;
  employee_surname: string | null;
  employee_email: string | null;
  items: EmployeeSoftwareItem[];
  monthly_total: number;
};

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === 'string' && BILLING_CYCLES.includes(value as BillingCycle);
}

/** Normalize any billing cycle to a monthly PKR equivalent for totals. */
export function monthlyEquivalent(amount: number | null, cycle: BillingCycle): number {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  if (cycle === 'yearly') {
    return Math.round((amount / 12) * 100) / 100;
  }
  if (cycle === 'one_time') {
    return 0;
  }
  return amount;
}

export function groupSoftwareByEmployee(items: EmployeeSoftwareItem[]): EmployeeSoftwareGroup[] {
  const byUser = new Map<string, EmployeeSoftwareGroup>();

  for (const item of items) {
    if (!item.is_active) {
      continue;
    }
    let group = byUser.get(item.user_id);
    if (!group) {
      group = {
        user_id: item.user_id,
        employee_name: item.employee_name,
        employee_surname: item.employee_surname,
        employee_email: item.employee_email,
        items: [],
        monthly_total: 0,
      };
      byUser.set(item.user_id, group);
    }
    group.items.push(item);
    group.monthly_total += monthlyEquivalent(item.monthly_amount, item.billing_cycle);
  }

  return Array.from(byUser.values()).sort((a, b) => {
    const an = [a.employee_name, a.employee_surname, a.employee_email].filter(Boolean).join(' ').toLowerCase();
    const bn = [b.employee_name, b.employee_surname, b.employee_email].filter(Boolean).join(' ').toLowerCase();
    return an.localeCompare(bn);
  });
}
