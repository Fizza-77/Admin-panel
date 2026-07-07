import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { ensureAppProfileRowsForUserIds } from '@/lib/permissions/appProfileDb';
import { reportError } from '@/lib/monitoring';
import { formatDbError, isMissingTableError, ATTENDANCE_SETUP_HINT } from '@/lib/db/errors';
import {
  isAttendanceStatus,
  monthDateRange,
  todayDateInputValue,
  type AttendanceRow,
  type AttendanceStatus,
} from '@/lib/attendance/types';
import { eachDayInMonth, isWorkingDayString } from '@/lib/attendance/workingDays';
import {
  emptyTeamDaySummary,
  type TeamDaySummary,
} from '@/lib/attendance/teamDaySummary';
import { notifyAttendanceMarked } from '@/lib/attendance/notifyMarked';
import type { AttendanceMarkedEntry } from '@/lib/attendance/types';

function parseDateParam(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return null;
  }
  const d = new Date(`${raw.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return raw.trim();
}

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

function buildMonthDaySummaries(
  teamSize: number,
  records: Array<{ attendance_date: string; status: string }>,
  month: string,
): Record<string, TeamDaySummary> {
  const byDate = new Map<string, TeamDaySummary>();

  for (const date of eachDayInMonth(month)) {
    if (!isWorkingDayString(date)) {
      continue;
    }
    byDate.set(date, emptyTeamDaySummary(teamSize));
  }

  for (const row of records) {
    if (!isAttendanceStatus(row.status)) {
      continue;
    }
    const date = String(row.attendance_date).slice(0, 10);
    const summary = byDate.get(date);
    if (!summary) {
      continue;
    }
    summary.marked += 1;
    summary.unmarked = Math.max(0, summary.unmarked - 1);
    switch (row.status) {
      case 'present':
        summary.present += 1;
        break;
      case 'absent':
        summary.absent += 1;
        break;
      case 'late':
        summary.late += 1;
        break;
      case 'leave':
        summary.leave += 1;
        break;
      default:
        break;
    }
  }

  const out: Record<string, TeamDaySummary> = {};
  for (const [date, summary] of byDate) {
    out[date] = summary;
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { attendance: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method === 'GET') {
    const rawMonth = typeof req.query.month === 'string' ? req.query.month.trim() : null;
    const monthRange = rawMonth ? monthDateRange(rawMonth) : null;

    if (rawMonth && !monthRange) {
      return res.status(400).json({ message: 'Query month must be YYYY-MM' });
    }

    if (monthRange) {
      const { users, error: listError } = await listAllAuthUsers();
      if (listError || !users) {
        reportError(listError ?? new Error('listUsers failed'), { source: 'api/attendance GET month listUsers' });
        return res.status(500).json({ message: listError?.message || 'Failed to list users' });
      }

      const teamSize = users.length;
      const { data: records, error: recError } = await supabase
        .from('attendance_records')
        .select('attendance_date, status')
        .gte('attendance_date', monthRange.from)
        .lte('attendance_date', monthRange.to);

      if (recError) {
        reportError(recError, { source: 'api/attendance GET month records', month: rawMonth });
        if (isMissingTableError(recError, 'attendance_records')) {
          return res.status(503).json({ message: ATTENDANCE_SETUP_HINT, code: 'attendance_not_migrated' });
        }
        return res.status(500).json({
          message: 'Failed to load attendance records',
          detail: formatDbError(recError),
        });
      }

      return res.status(200).json({
        month: rawMonth,
        from: monthRange.from,
        to: monthRange.to,
        team_size: teamSize,
        days: buildMonthDaySummaries(teamSize, records ?? [], rawMonth!),
      });
    }

    const date = parseDateParam(req.query.date) ?? todayDateInputValue();

    const { users, error: listError } = await listAllAuthUsers();
    if (listError || !users) {
      reportError(listError ?? new Error('listUsers failed'), { source: 'api/attendance GET listUsers' });
      return res.status(500).json({ message: listError?.message || 'Failed to list users' });
    }

    const ids = users.map((u) => u.id);
    const { byUserId, error: profError, stillMissingUserIds } = await ensureAppProfileRowsForUserIds(ids);
    if (profError || stillMissingUserIds.length > 0) {
      reportError(profError ?? new Error('missing profiles'), { source: 'api/attendance GET profiles' });
      return res.status(500).json({ message: 'Failed to load user profiles' });
    }

    const { data: records, error: recError } = await supabase
      .from('attendance_records')
      .select('id, user_id, status, notes, late_hours')
      .eq('attendance_date', date);

    if (recError) {
      reportError(recError, { source: 'api/attendance GET records', date });
      if (isMissingTableError(recError, 'attendance_records')) {
        return res.status(503).json({ message: ATTENDANCE_SETUP_HINT, code: 'attendance_not_migrated' });
      }
      return res.status(500).json({
        message: 'Failed to load attendance records',
        detail: formatDbError(recError),
      });
    }

    const recordByUser = new Map(
      (records ?? []).map((r) => [
        r.user_id as string,
        {
          id: r.id as string,
          status: r.status as AttendanceStatus,
          notes: typeof r.notes === 'string' ? r.notes : null,
          late_hours: r.late_hours != null ? Number(r.late_hours) : null,
        },
      ]),
    );

    const rows: AttendanceRow[] = users
      .map((u) => {
        const profile = byUserId.get(u.id);
        const rec = recordByUser.get(u.id);
        return {
          user_id: u.id,
          email: u.email ?? null,
          display_name: profile?.display_name ?? null,
          avatar_url: profile?.avatar_url ?? null,
          status: rec?.status ?? null,
          notes: rec?.notes ?? null,
          late_hours: rec?.late_hours ?? null,
          record_id: rec?.id ?? null,
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
      rows,
    });
  }

  if (req.method === 'PUT') {
    const body = req.body ?? {};
    const date = parseDateParam(body.date);
    if (!date) {
      return res.status(400).json({ message: 'Body must include date as YYYY-MM-DD' });
    }

    if (!isWorkingDayString(date)) {
      return res.status(400).json({ message: 'Sunday is off — attendance is only recorded on working days (Mon–Sat).' });
    }

    const entries = body.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'Body must include a non-empty entries array' });
    }

    const now = new Date().toISOString();
    let saved = 0;

    const { data: existingRows } = await supabase
      .from('attendance_records')
      .select('user_id, status, notes, late_hours')
      .eq('attendance_date', date);

    const previousByUser = new Map(
      (existingRows ?? []).map((row) => [
        row.user_id as string,
        {
          status: row.status as AttendanceStatus,
          notes: (row.notes as string | null) ?? null,
          late_hours: row.late_hours as number | null,
        },
      ]),
    );

    const toNotify: AttendanceMarkedEntry[] = [];

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const user_id = typeof entry.user_id === 'string' ? entry.user_id : '';
      const status = entry.status;
      if (!user_id) {
        continue;
      }

      if (status === null || status === '' || status === 'unmarked') {
        const { error: delError } = await supabase
          .from('attendance_records')
          .delete()
          .eq('user_id', user_id)
          .eq('attendance_date', date);
        if (delError) {
          reportError(delError, { source: 'api/attendance PUT delete', user_id, date });
          return res.status(500).json({ message: formatDbError(delError) || 'Failed to clear attendance' });
        }
        continue;
      }

      if (!isAttendanceStatus(status)) {
        return res.status(400).json({ message: `Invalid status for user ${user_id}` });
      }

      const notes =
        typeof entry.notes === 'string' ? entry.notes.trim().slice(0, 500) || null : null;

      let late_hours: number | null = null;
      if (status === 'late') {
        const rawLate = entry.late_hours;
        if (rawLate !== null && rawLate !== undefined && rawLate !== '') {
          const parsed = Number(rawLate);
          if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24) {
            return res.status(400).json({
              message: `Late hours must be between 0 and 24 for user ${user_id}`,
            });
          }
          late_hours = Math.round(parsed * 100) / 100;
        }
      }

      const { error: upsertError } = await supabase.from('attendance_records').upsert(
        {
          user_id,
          attendance_date: date,
          status,
          notes,
          late_hours,
          marked_by: auth.userId,
          updated_at: now,
        },
        { onConflict: 'user_id,attendance_date' },
      );

      if (upsertError) {
        reportError(upsertError, { source: 'api/attendance PUT upsert', user_id, date });
        return res.status(500).json({
          message: formatDbError(upsertError) || 'Failed to save attendance',
        });
      }

      const previous = previousByUser.get(user_id);
      const changed =
        !previous ||
        previous.status !== status ||
        previous.notes !== notes ||
        (status === 'late' && previous.late_hours !== late_hours);

      if (changed) {
        toNotify.push({ userId: user_id, date, status, lateHours: late_hours });
      }

      saved += 1;
    }

    if (toNotify.length > 0) {
      try {
        await notifyAttendanceMarked(toNotify, auth.userId);
      } catch (notifyError) {
        reportError(notifyError, { source: 'api/attendance PUT notify', date, count: toNotify.length });
      }
    }

    return res.status(200).json({ success: true, date, saved });
  }

  res.setHeader('Allow', ['GET', 'PUT']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
