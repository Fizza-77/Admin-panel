import type { AppPermissions } from '@/lib/permissions/types';

/** Users who may mark team attendance (matches API / page guards). */
export function canMarkTeamAttendance(permissions: AppPermissions | undefined | null): boolean {
  if (!permissions) {
    return false;
  }
  return permissions.canManageAttendance || permissions.isPrimaryAdmin;
}
