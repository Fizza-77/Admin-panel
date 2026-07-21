import type { AppPermissions } from '@/lib/permissions/types';

/** Users who may access Payroll (independent of attendance control). */
export function canAccessPayroll(permissions: AppPermissions | undefined | null): boolean {
  if (!permissions) {
    return false;
  }
  return permissions.canManagePayroll || permissions.isPrimaryAdmin;
}
