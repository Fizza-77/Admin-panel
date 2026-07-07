import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import type { PendingTaskAttachment } from '@/lib/tasks/taskAttachments';

export async function insertTaskAttachments(
  taskId: string,
  userId: string,
  attachments: PendingTaskAttachment[],
): Promise<void> {
  if (attachments.length === 0) {
    return;
  }

  const rows = attachments.map((a) => ({
    task_id: taskId,
    file_name: a.file_name,
    file_url: a.file_url,
    file_type: a.file_type,
    file_size: a.file_size,
    uploaded_by: userId,
  }));

  const { error } = await supabase.from('task_attachments').insert(rows);
  if (error) {
    reportError(error, { source: 'insertTaskAttachments', taskId });
    throw new Error(error.message || 'Failed to save attachments');
  }
}

export async function replaceTaskAttachments(
  taskId: string,
  userId: string,
  keepIds: string[],
  newAttachments: PendingTaskAttachment[],
): Promise<void> {
  const { data: existing, error: listError } = await supabase
    .from('task_attachments')
    .select('id')
    .eq('task_id', taskId);

  if (listError) {
    reportError(listError, { source: 'replaceTaskAttachments list', taskId });
    throw new Error(listError.message || 'Failed to load attachments');
  }

  const keep = new Set(keepIds);
  const toDelete = (existing ?? []).map((r) => r.id as string).filter((id) => !keep.has(id));

  if (toDelete.length > 0) {
    const { error: delError } = await supabase.from('task_attachments').delete().in('id', toDelete);
    if (delError) {
      reportError(delError, { source: 'replaceTaskAttachments delete', taskId });
      throw new Error(delError.message || 'Failed to remove attachments');
    }
  }

  if (newAttachments.length > 0) {
    await insertTaskAttachments(taskId, userId, newAttachments);
  }
}
