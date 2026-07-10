import type { AppPermissions } from '@/lib/permissions/types';

/** Users who may access the expense tracker (matches API / page guards). */
export function canAccessExpenseTracker(permissions: AppPermissions | undefined | null): boolean {
  if (!permissions) {
    return false;
  }
  return permissions.canManageExpenses || permissions.isPrimaryAdmin;
}
