import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { ATTENDANCE_STATUS_LABELS, type AttendanceMarkedEntry } from '@/lib/attendance/types';
import { formatLateHours } from '@/lib/attendance/reports';
import { sendAttendanceMarkedEmails } from '@/lib/email/attendanceMarkedEmail';

function formatAttendanceDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildNotificationBody(entry: AttendanceMarkedEntry): string {
  const dateLabel = formatAttendanceDate(entry.date);
  const statusLabel = ATTENDANCE_STATUS_LABELS[entry.status];
  if (entry.status === 'late' && entry.lateHours != null) {
    return `${dateLabel} — Marked as ${statusLabel} (${formatLateHours(entry.lateHours)} late)`;
  }
  return `${dateLabel} — Marked as ${statusLabel}`;
}

export async function notifyAttendanceMarked(
  entries: AttendanceMarkedEntry[],
  markedByUserId: string,
): Promise<void> {
  const recipients = entries.filter((entry) => entry.userId && entry.userId !== markedByUserId);
  if (recipients.length === 0) {
    return;
  }

  const title = 'Attendance marked';
  const rows = recipients.map((entry) => ({
    user_id: entry.userId,
    attendance_date: entry.date,
    title,
    body: buildNotificationBody(entry),
  }));

  const { error } = await supabase.from('attendance_notifications').insert(rows);
  if (error) {
    reportError(error, {
      source: 'notifyAttendanceMarked.insert',
      count: recipients.length,
    });
  }

  try {
    await sendAttendanceMarkedEmails({
      entries: recipients,
      markedByUserId,
    });
  } catch (emailError) {
    reportError(emailError, {
      source: 'notifyAttendanceMarked.email',
      count: recipients.length,
    });
  }
}
