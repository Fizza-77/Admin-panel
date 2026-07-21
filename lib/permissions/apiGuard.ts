import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveAdminUserContextFromApi } from '@/lib/auth/resolveUserContext';
import { canAccessPayroll } from './payrollAccess';
import { canAccessEmployeesDirectory, canSetEmployeeProfiles } from './profileAccess';
import type { AppPermissions } from './types';

export type ApiPermissionResult =
  | { ok: true; userId: string; permissions: AppPermissions }
  | { ok: false; status: number; message: string };

/**
 * Validates session + loads permissions in one step, then checks feature flags.
 */
export async function requireApiPermission(
  req: NextApiRequest,
  res: NextApiResponse | undefined,
  needs: {
    blogs?: boolean;
    tasks?: boolean;
    users?: boolean;
    attendance?: boolean;
    expenses?: boolean;
    profiles?: boolean;
    employees?: boolean;
    payroll?: boolean;
  },
): Promise<ApiPermissionResult> {
  const ctx = await resolveAdminUserContextFromApi(req, res);
  if (!ctx) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const { permissions, userId, profileLoadError } = ctx;

  if (profileLoadError && !permissions.isPrimaryAdmin) {
    return {
      ok: false,
      status: 503,
      message: `Permission system unavailable: ${profileLoadError}`,
    };
  }

  if (needs.blogs && !permissions.canManageBlogs) {
    return { ok: false, status: 403, message: 'You do not have access to blog management.' };
  }
  if (needs.tasks && !permissions.canManageTasks) {
    return { ok: false, status: 403, message: 'You do not have access to tasks.' };
  }
  if (needs.users && !permissions.canAccessUserManagement) {
    return { ok: false, status: 403, message: 'You do not have access to user management.' };
  }
  if (needs.attendance && !permissions.canManageAttendance && !permissions.isPrimaryAdmin) {
    return { ok: false, status: 403, message: 'You do not have access to attendance control.' };
  }
  if (needs.expenses && !permissions.canManageExpenses && !permissions.isPrimaryAdmin) {
    return { ok: false, status: 403, message: 'You do not have access to the expense tracker.' };
  }
  if (needs.profiles && !canSetEmployeeProfiles(permissions)) {
    return { ok: false, status: 403, message: 'You do not have access to set employee profiles.' };
  }
  if (needs.employees && !canAccessEmployeesDirectory(permissions)) {
    return { ok: false, status: 403, message: 'You do not have access to the employees directory.' };
  }
  if (needs.payroll && !canAccessPayroll(permissions)) {
    return { ok: false, status: 403, message: 'You do not have access to payroll.' };
  }

  return { ok: true, userId, permissions };
}
