import { supabase } from '@/lib/supabase/server';
import { fetchAppProfileRow } from '@/lib/permissions/appProfileDb';
import { reportError } from '@/lib/monitoring';
import { sendMail } from '@/lib/email/mailer';
import { getAdminPanelUrl, isSmtpConfigured } from '@/lib/email/smtpConfig';
import { userDisplayLabel } from '@/lib/users/display';
import { ATTENDANCE_STATUS_LABELS } from '@/lib/attendance/types';
import { formatLateHours } from '@/lib/attendance/reports';
import type { AttendanceMarkedEntry } from '@/lib/attendance/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAttendanceDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

type SendAttendanceMarkedEmailsParams = {
  entries: AttendanceMarkedEntry[];
  markedByUserId: string;
};

async function resolveUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    reportError(error, { source: 'attendanceMarkedEmail.getUserById', userId });
    return null;
  }
  return data?.user?.email?.trim() ?? null;
}

async function resolveDisplayName(userId: string): Promise<string | null> {
  const { row } = await fetchAppProfileRow(userId);
  return row?.display_name ?? null;
}

function buildEmailContent(params: {
  entry: AttendanceMarkedEntry;
  actorLabel: string;
  recipientLabel: string;
  attendanceUrl: string | null;
}) {
  const dateLabel = formatAttendanceDate(params.entry.date);
  const statusLabel = ATTENDANCE_STATUS_LABELS[params.entry.status];
  const lateNote =
    params.entry.status === 'late' && params.entry.lateHours != null
      ? ` (${formatLateHours(params.entry.lateHours)} late)`
      : '';

  const subject = `Attendance marked: ${dateLabel}`;
  const intro = `${params.actorLabel} marked your attendance for ${dateLabel}.`;

  const textLines = [
    `Hi ${params.recipientLabel},`,
    '',
    intro,
    '',
    `Status: ${statusLabel}${lateNote}`,
    params.attendanceUrl
      ? `View attendance: ${params.attendanceUrl}`
      : 'Open the Skyen admin panel and go to Attendance.',
    '',
    '— Skyen Admin',
  ];

  const attendanceButton = params.attendanceUrl
    ? `<p style="margin:24px 0 0;"><a href="${params.attendanceUrl}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">View attendance</a></p>`
    : '';

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;max-width:560px;">
      <p>Hi ${escapeHtml(params.recipientLabel)},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:20px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Status</strong>
        <span style="font-size:16px;font-weight:600;">${escapeHtml(statusLabel)}${escapeHtml(lateNote)}</span>
      </p>
      ${attendanceButton}
      <p style="margin-top:28px;font-size:12px;color:#94a3b8;">Skyen Admin</p>
    </div>
  `.trim();

  return { subject, text: textLines.join('\n'), html };
}

export async function sendAttendanceMarkedEmails(
  params: SendAttendanceMarkedEmailsParams,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const recipients = params.entries.filter(
    (entry) => entry.userId && entry.userId !== params.markedByUserId,
  );
  if (recipients.length === 0) {
    return;
  }

  const actorProfile = await resolveDisplayName(params.markedByUserId);
  const actorEmail = await resolveUserEmail(params.markedByUserId);
  const actorLabel = userDisplayLabel(actorProfile, actorEmail);

  const panelUrl = getAdminPanelUrl();
  const attendanceUrl = panelUrl ? `${panelUrl}/attendance` : null;

  const results = await Promise.allSettled(
    recipients.map(async (entry) => {
      const email = await resolveUserEmail(entry.userId);
      if (!email) {
        return;
      }

      const displayName = await resolveDisplayName(entry.userId);
      const recipientLabel = userDisplayLabel(displayName, email);
      const { subject, text, html } = buildEmailContent({
        entry,
        actorLabel,
        recipientLabel,
        attendanceUrl,
      });

      await sendMail({
        to: email,
        subject,
        text,
        html,
      });
    }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      reportError(result.reason, { source: 'sendAttendanceMarkedEmails' });
    }
  }
}
