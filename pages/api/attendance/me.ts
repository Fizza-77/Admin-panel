import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { resolveAdminUserContextFromApi } from '@/lib/auth/resolveUserContext';
import { reportError } from '@/lib/monitoring';
import { formatDbError, isMissingTableError, ATTENDANCE_SETUP_HINT } from '@/lib/db/errors';
import {
  isAttendanceStatus,
  monthDateRange,
  monthInputValue,
  type AttendanceStatus,
  type PersonalAttendanceEntry,
} from '@/lib/attendance/types';

function mapRecord(row: {
  attendance_date: unknown;
  status: unknown;
  notes: unknown;
  late_hours: unknown;
  updated_at: unknown;
}): PersonalAttendanceEntry | null {
  if (!isAttendanceStatus(row.status)) {
    return null;
  }
  return {
    attendance_date: String(row.attendance_date).slice(0, 10),
    status: row.status as AttendanceStatus,
    notes: typeof row.notes === 'string' ? row.notes : null,
    late_hours: row.late_hours != null ? Number(row.late_hours) : null,
    updated_at: row.updated_at as string,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const ctx = await resolveAdminUserContextFromApi(req, res);
  if (!ctx) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (ctx.profileLoadError && !ctx.permissions.isPrimaryAdmin) {
    return res.status(503).json({ message: `Permission system unavailable: ${ctx.profileLoadError}` });
  }

  const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : monthInputValue();
  const range = monthDateRange(rawMonth);
  if (!range) {
    return res.status(400).json({ message: 'Query month must be YYYY-MM' });
  }

  const year = rawMonth.slice(0, 4);
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` };

  const [monthResult, yearLeaveResult] = await Promise.all([
    supabase
      .from('attendance_records')
      .select('attendance_date, status, notes, late_hours, updated_at')
      .eq('user_id', ctx.userId)
      .gte('attendance_date', range.from)
      .lte('attendance_date', range.to)
      .order('attendance_date', { ascending: false }),
    supabase
      .from('attendance_records')
      .select('attendance_date, status, late_hours')
      .eq('user_id', ctx.userId)
      .eq('status', 'leave')
      .gte('attendance_date', yearRange.from)
      .lte('attendance_date', yearRange.to),
  ]);

  const { data, error } = monthResult;
  if (error) {
    reportError(error, { source: 'api/attendance/me GET', userId: ctx.userId, month: rawMonth });
    if (isMissingTableError(error, 'attendance_records')) {
      return res.status(503).json({
        message: ATTENDANCE_SETUP_HINT,
        code: 'attendance_not_migrated',
      });
    }
    return res.status(500).json({
      message: 'Failed to load your attendance',
      detail: formatDbError(error),
    });
  }

  if (yearLeaveResult.error) {
    reportError(yearLeaveResult.error, {
      source: 'api/attendance/me GET year leaves',
      userId: ctx.userId,
      year,
    });
    if (isMissingTableError(yearLeaveResult.error, 'attendance_records')) {
      return res.status(503).json({
        message: ATTENDANCE_SETUP_HINT,
        code: 'attendance_not_migrated',
      });
    }
  }

  const records: PersonalAttendanceEntry[] = (data ?? [])
    .map(mapRecord)
    .filter((r): r is PersonalAttendanceEntry => r !== null);

  const yearLeaveRecords = (yearLeaveResult.data ?? [])
    .filter((row) => isAttendanceStatus(row.status))
    .map((row) => ({
      attendance_date: String(row.attendance_date).slice(0, 10),
      status: row.status as AttendanceStatus,
      late_hours: row.late_hours != null ? Number(row.late_hours) : null,
    }));

  return res.status(200).json({
    month: rawMonth,
    from: range.from,
    to: range.to,
    records,
    yearLeaveRecords,
  });
}
