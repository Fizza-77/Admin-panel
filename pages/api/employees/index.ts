import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { ensureAppProfileRowsForUserIds } from '@/lib/permissions/appProfileDb';
import { canMarkTeamAttendance } from '@/lib/permissions/attendanceAccess';
import { reportError } from '@/lib/monitoring';
import { formatDbError, isMissingTableError, ATTENDANCE_SETUP_HINT } from '@/lib/db/errors';
import { todayDateInputValue, type AttendanceStatus } from '@/lib/attendance/types';
import { isWorkingDayString } from '@/lib/attendance/workingDays';

async function listAllAuthUsers() {
  const users: Array<{ id: string; email?: string; created_at: string }> = [];
  let page = 1;
  const perPage = 100;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      return { users: null as null, error };
    }
    const batch = data?.users ?? [];
    for (const u of batch) {
      users.push({ id: u.id, email: u.email, created_at: u.created_at });
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { employees: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const includeAttendance = canMarkTeamAttendance(auth.permissions);
  const date = todayDateInputValue();

  const { users, error: listError } = await listAllAuthUsers();
  if (listError || !users) {
    reportError(listError ?? new Error('listUsers failed'), { source: 'api/employees GET listUsers' });
    return res.status(500).json({ message: listError?.message || 'Failed to list users' });
  }

  const ids = users.map((u) => u.id);
  const { byUserId, error: profError, stillMissingUserIds } = await ensureAppProfileRowsForUserIds(ids);
  if (profError || stillMissingUserIds.length > 0) {
    reportError(profError ?? new Error('missing profiles'), { source: 'api/employees GET profiles' });
    return res.status(500).json({ message: 'Failed to load user profiles' });
  }

  const recordByUser = new Map<
    string,
    { id: string; status: AttendanceStatus; notes: string | null; late_hours: number | null }
  >();

  if (includeAttendance) {
    const { data: records, error: recError } = await supabase
      .from('attendance_records')
      .select('id, user_id, status, notes, late_hours')
      .eq('attendance_date', date);

    if (recError) {
      reportError(recError, { source: 'api/employees GET attendance', date });
      if (isMissingTableError(recError, 'attendance_records')) {
        return res.status(503).json({ message: ATTENDANCE_SETUP_HINT, code: 'attendance_not_migrated' });
      }
      return res.status(500).json({
        message: 'Failed to load attendance records',
        detail: formatDbError(recError),
      });
    }

    for (const r of records ?? []) {
      recordByUser.set(r.user_id as string, {
        id: r.id as string,
        status: r.status as AttendanceStatus,
        notes: typeof r.notes === 'string' ? r.notes : null,
        late_hours: r.late_hours != null ? Number(r.late_hours) : null,
      });
    }
  }

  const rows = users
    .map((u) => {
      const profile = byUserId.get(u.id);
      const rec = recordByUser.get(u.id);
      return {
        user_id: u.id,
        email: u.email ?? null,
        display_name: profile?.display_name ?? null,
        surname: profile?.surname ?? null,
        qualification: profile?.qualification ?? null,
        contact_info: profile?.contact_info ?? null,
        company_role: profile?.company_role ?? null,
        salary: profile?.salary ?? null,
        avatar_url: profile?.avatar_url ?? null,
        status: includeAttendance ? (rec?.status ?? null) : null,
        notes: includeAttendance ? (rec?.notes ?? null) : null,
        late_hours: includeAttendance ? (rec?.late_hours ?? null) : null,
        record_id: includeAttendance ? (rec?.id ?? null) : null,
      };
    })
    .sort((a, b) => {
      const an = (a.display_name || a.email || '').toLowerCase();
      const bn = (b.display_name || b.email || '').toLowerCase();
      return an.localeCompare(bn);
    });

  return res.status(200).json({
    date,
    is_working_day: isWorkingDayString(date),
    include_attendance: includeAttendance,
    rows,
  });
}
