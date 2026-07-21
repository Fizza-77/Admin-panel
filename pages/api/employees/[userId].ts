import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import {
  fetchAppProfileRow,
  updateEmployeeAdminProfile,
  updateEmployeePersonalProfile,
} from '@/lib/permissions/appProfileDb';
import { canMarkTeamAttendance } from '@/lib/permissions/attendanceAccess';
import { canSetEmployeeProfiles } from '@/lib/permissions/profileAccess';
import { mapEmployeeProfile, normalizeAdminInput, normalizePersonalInput } from '@/lib/employees/profile';
import {
  clearPayrollExpenseExclusionsFromMonth,
  removePayrollExpensesForEmployeeFromMonth,
  syncPayrollExpensesFromMonth,
} from '@/lib/expenses/payrollExpenseSync';
import { clearPayrollDeductionsFromMonth } from '@/lib/payroll/deductions';
import { clearPayrollBonusesFromMonth } from '@/lib/payroll/bonuses';
import { monthInputValue } from '@/lib/expenses/types';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { employees: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    reportError(authErr ?? new Error('User not found'), { source: 'api/employees GET user', userId });
    return res.status(404).json({ message: 'Employee not found' });
  }

  if (req.method === 'GET') {
    const { row, error } = await fetchAppProfileRow(userId);
    if (error) {
      reportError(error, { source: 'api/employees GET profile', userId });
      return res.status(500).json({ message: formatDbError(error) });
    }

    return res.status(200).json({
      employee: mapEmployeeProfile(userId, authUser.user.email, row),
    });
  }

  if (req.method === 'PATCH') {
    const canEditAll = canSetEmployeeProfiles(auth.permissions);
    const canEditAdminFields = canEditAll || canMarkTeamAttendance(auth.permissions);
    if (!canEditAdminFields) {
      return res.status(403).json({ message: 'You do not have permission to edit employee profiles.' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const personalKeys = ['display_name', 'surname', 'qualification', 'contact_info'] as const;
    const hasPersonalPatch = personalKeys.some((key) => body[key] !== undefined);
    const hasAdminPatch = body.company_role !== undefined || body.salary !== undefined;

    if (hasPersonalPatch && !canEditAll) {
      return res.status(403).json({
        message: 'Set profiles permission is required to edit personal profile fields.',
      });
    }

    if (!hasPersonalPatch && !hasAdminPatch) {
      return res.status(400).json({ message: 'No profile fields to update' });
    }

    const { row: existing, error: readErr } = await fetchAppProfileRow(userId);
    if (readErr) {
      reportError(readErr, { source: 'api/employees PATCH read', userId });
      return res.status(500).json({ message: 'Failed to read profile' });
    }

    if (hasPersonalPatch) {
      const personal = normalizePersonalInput(body);
      const nextPersonal = {
        display_name:
          body.display_name !== undefined ? personal.display_name : (existing?.display_name ?? null),
        surname: body.surname !== undefined ? personal.surname : (existing?.surname ?? null),
        qualification:
          body.qualification !== undefined ? personal.qualification : (existing?.qualification ?? null),
        contact_info:
          body.contact_info !== undefined ? personal.contact_info : (existing?.contact_info ?? null),
      };
      const personalResult = await updateEmployeePersonalProfile(userId, nextPersonal);
      if (!personalResult.ok) {
        reportError(personalResult.error, { source: 'api/employees PATCH personal', userId });
        return res.status(500).json({ message: formatDbError(personalResult.error) });
      }
    }

    if (hasAdminPatch) {
      const parsed = normalizeAdminInput(body);
      if ('error' in parsed) {
        return res.status(400).json({ message: parsed.error });
      }

      const nextAdmin = {
        company_role:
          body.company_role !== undefined ? parsed.company_role : (existing?.company_role ?? null),
        salary: body.salary !== undefined ? parsed.salary : (existing?.salary ?? null),
      };

      const result = await updateEmployeeAdminProfile(userId, nextAdmin);
      if (!result.ok) {
        reportError(result.error, { source: 'api/employees PATCH update', userId });
        return res.status(500).json({ message: formatDbError(result.error) });
      }

      if (body.salary !== undefined) {
        const month = monthInputValue();
        const nextSalary = nextAdmin.salary;
        if (nextSalary == null || nextSalary <= 0) {
          await removePayrollExpensesForEmployeeFromMonth(userId, month);
          await clearPayrollDeductionsFromMonth(userId, month);
          await clearPayrollBonusesFromMonth(userId, month);
        } else {
          await clearPayrollExpenseExclusionsFromMonth(userId, month);
          await syncPayrollExpensesFromMonth(month, auth.userId);
        }
      }
    }

    const { row: updated } = await fetchAppProfileRow(userId);
    return res.status(200).json({
      employee: mapEmployeeProfile(userId, authUser.user.email, updated),
    });
  }

  res.setHeader('Allow', ['GET', 'PATCH']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
