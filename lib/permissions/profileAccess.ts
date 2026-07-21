import type { AppPermissions } from '@/lib/permissions/types';

/** Users who may open All Employees (attendance admins or set-profiles). */
export function canAccessEmployeesDirectory(permissions: AppPermissions | undefined | null): boolean {
  if (!permissions) {
    return false;
  }
  return (
    permissions.canManageAttendance ||
    permissions.canManageProfiles ||
    permissions.isPrimaryAdmin
  );
}

/** Users who may edit all employee profile fields (personal + role/salary). */
export function canSetEmployeeProfiles(permissions: AppPermissions | undefined | null): boolean {
  if (!permissions) {
    return false;
  }
  return permissions.canManageProfiles || permissions.isPrimaryAdmin;
}
