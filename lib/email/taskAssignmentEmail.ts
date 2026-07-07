import { supabase } from '@/lib/supabase/server';
import { fetchAppProfileRow } from '@/lib/permissions/appProfileDb';
import { reportError } from '@/lib/monitoring';
import { sendMail } from '@/lib/email/mailer';
import { getAdminPanelUrl, isSmtpConfigured } from '@/lib/email/smtpConfig';
import { userDisplayLabel } from '@/lib/users/display';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type SendTaskAssignmentEmailsParams = {
  taskId: string;
  taskTitle: string;
  assigneeIds: string[];
  actorUserId: string;
  isNewTask?: boolean;
};

async function resolveUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    reportError(error, { source: 'taskAssignmentEmail.getUserById', userId });
    return null;
  }
  return data?.user?.email?.trim() ?? null;
}

async function resolveDisplayName(userId: string): Promise<string | null> {
  const { row } = await fetchAppProfileRow(userId);
  return row?.display_name ?? null;
}

function buildEmailContent(params: {
  taskTitle: string;
  isNewTask: boolean;
  actorLabel: string;
  recipientLabel: string;
  tasksUrl: string | null;
}) {
  const title = params.taskTitle.trim() || 'Untitled task';
  const subject = params.isNewTask
    ? `New task assigned: ${title}`
    : `You were assigned to a task: ${title}`;

  const intro = params.isNewTask
    ? `${params.actorLabel} assigned you a new task.`
    : `${params.actorLabel} added you to a task.`;

  const textLines = [
    `Hi ${params.recipientLabel},`,
    '',
    intro,
    '',
    `Task: ${title}`,
    params.tasksUrl ? `Open tasks: ${params.tasksUrl}` : 'Open the Skyen admin panel and go to Tasks.',
    '',
    '— Skyen Admin',
  ];

  const tasksButton = params.tasksUrl
    ? `<p style="margin:24px 0 0;"><a href="${params.tasksUrl}" style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;">Open tasks</a></p>`
    : '';

  const html = `
    <div style="font-family:Inter,Segoe UI,sans-serif;line-height:1.6;color:#0f172a;max-width:560px;">
      <p>Hi ${escapeHtml(params.recipientLabel)},</p>
      <p>${escapeHtml(intro)}</p>
      <p style="margin:20px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
        <strong style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;">Task</strong>
        <span style="font-size:16px;font-weight:600;">${escapeHtml(title)}</span>
      </p>
      ${tasksButton}
      <p style="margin-top:28px;font-size:12px;color:#94a3b8;">Skyen Admin</p>
    </div>
  `.trim();

  return { subject, text: textLines.join('\n'), html };
}

export async function sendTaskAssignmentEmails(
  params: SendTaskAssignmentEmailsParams,
): Promise<void> {
  if (!isSmtpConfigured()) {
    return;
  }

  const recipients = params.assigneeIds.filter((id) => id && id !== params.actorUserId);
  if (recipients.length === 0) {
    return;
  }

  const actorProfile = await resolveDisplayName(params.actorUserId);
  const actorEmail = await resolveUserEmail(params.actorUserId);
  const actorLabel = userDisplayLabel(actorProfile, actorEmail);

  const panelUrl = getAdminPanelUrl();
  const tasksUrl = panelUrl ? `${panelUrl}/tasks` : null;

  const results = await Promise.allSettled(
    recipients.map(async (userId) => {
      const email = await resolveUserEmail(userId);
      if (!email) {
        return;
      }

      const displayName = await resolveDisplayName(userId);
      const recipientLabel = userDisplayLabel(displayName, email);
      const { subject, text, html } = buildEmailContent({
        taskTitle: params.taskTitle,
        isNewTask: Boolean(params.isNewTask),
        actorLabel,
        recipientLabel,
        tasksUrl,
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
      reportError(result.reason, {
        source: 'sendTaskAssignmentEmails',
        taskId: params.taskId,
      });
    }
  }
}
