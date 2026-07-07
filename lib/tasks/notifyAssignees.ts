import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { sendTaskAssignmentEmails } from '@/lib/email/taskAssignmentEmail';

export async function notifyTaskAssignees(params: {
  taskId: string;
  taskTitle: string;
  assigneeIds: string[];
  actorUserId: string;
  isNewTask?: boolean;
}): Promise<void> {
  const { taskId, taskTitle, assigneeIds, actorUserId, isNewTask } = params;
  const recipients = assigneeIds.filter((id) => id && id !== actorUserId);
  if (recipients.length === 0) {
    return;
  }

  const title = isNewTask ? 'New task assigned to you' : 'You were assigned to a task';
  const body = `“${taskTitle.trim() || 'Untitled task'}” — open Tasks in the admin panel.`;

  const rows = recipients.map((user_id) => ({
    user_id,
    task_id: taskId,
    title,
    body,
  }));

  const { error } = await supabase.from('task_notifications').insert(rows);
  if (error) {
    reportError(error, { source: 'notifyTaskAssignees.insert', taskId, count: recipients.length });
  }

  try {
    await sendTaskAssignmentEmails({
      taskId,
      taskTitle,
      assigneeIds: recipients,
      actorUserId,
      isNewTask,
    });
  } catch (emailError) {
    reportError(emailError, { source: 'notifyTaskAssignees.email', taskId, count: recipients.length });
  }
}
