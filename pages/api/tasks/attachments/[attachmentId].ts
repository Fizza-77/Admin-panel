import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { isTaskSuperAdmin } from '@/lib/permissions/taskAdmin';
import { reportError } from '@/lib/monitoring';
import { canUserViewTask } from '@/lib/tasks/taskAccess';
import {
  attachmentContentDisposition,
  fetchCloudinaryAttachment,
} from '@/lib/tasks/fetchCloudinaryAttachment';
import { downloadTaskAttachment, isSupabaseStorageUrl } from '@/lib/storage/taskAttachments';

async function loadAssigneeIds(taskId: string): Promise<string[]> {
  const { data, error } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => row.user_id as string);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const attachmentId = req.query.attachmentId;
  if (typeof attachmentId !== 'string') {
    return res.status(400).json({ message: 'Invalid attachment id' });
  }

  const { data: attachment, error } = await supabase
    .from('task_attachments')
    .select('id, task_id, file_name, file_url, file_type')
    .eq('id', attachmentId)
    .maybeSingle();

  if (error) {
    reportError(error, { source: 'api/tasks/attachments GET', attachmentId });
    return res.status(500).json({ message: 'Failed to load attachment' });
  }

  if (!attachment) {
    return res.status(404).json({ message: 'Attachment not found' });
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, visibility, created_by')
    .eq('id', attachment.task_id)
    .maybeSingle();

  if (taskError || !task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  let assigneeIds: string[] = [];
  try {
    assigneeIds = await loadAssigneeIds(attachment.task_id as string);
  } catch (assigneeError) {
    reportError(assigneeError, { source: 'api/tasks/attachments assignees', attachmentId });
    return res.status(500).json({ message: 'Failed to verify task access' });
  }

  const isSuper = isTaskSuperAdmin(auth.permissions);
  if (!canUserViewTask(task, auth.userId, isSuper, assigneeIds)) {
    return res.status(403).json({ message: 'You cannot view this attachment' });
  }

  const fileUrl = attachment.file_url as string;
  const fileType = typeof attachment.file_type === 'string' ? attachment.file_type : null;

  try {
    const { buffer, contentType } = isSupabaseStorageUrl(fileUrl)
      ? await downloadTaskAttachment(fileUrl, fileType)
      : await fetchCloudinaryAttachment(fileUrl, fileType);

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      attachmentContentDisposition(String(attachment.file_name), true),
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(buffer);
  } catch (fetchError) {
    reportError(fetchError, { source: 'api/tasks/attachments stream', attachmentId });
    return res.status(502).json({ message: 'Failed to load attachment file' });
  }
}
