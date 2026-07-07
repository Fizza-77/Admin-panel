import type { TaskAttachment } from '@/lib/tasks/taskAttachments';
import type { TaskWithRelations } from '@/lib/tasks/taskRow';

export function mapTaskRow(raw: Record<string, unknown>): TaskWithRelations {
  const assigneeRows = raw.task_assignees as { user_id: string }[] | undefined;
  const tagRows = raw.task_tag_links as { tag_id: string }[] | undefined;
  const attachmentRows = raw.task_attachments as TaskAttachment[] | undefined;
  const { task_assignees: _a, task_tag_links: _t, task_attachments: _f, ...rest } = raw;

  return {
    ...(rest as Omit<TaskWithRelations, 'assignee_ids' | 'tag_ids' | 'attachments'>),
    assignee_ids: Array.isArray(assigneeRows) ? assigneeRows.map((r) => r.user_id) : [],
    tag_ids: Array.isArray(tagRows) ? tagRows.map((r) => r.tag_id) : [],
    attachments: Array.isArray(attachmentRows)
      ? attachmentRows.map((a) => ({
          id: String(a.id),
          task_id: String(a.task_id),
          file_name: String(a.file_name),
          file_url: String(a.file_url),
          file_type: a.file_type != null ? String(a.file_type) : null,
          file_size: a.file_size != null ? Number(a.file_size) : null,
          uploaded_by: String(a.uploaded_by),
          created_at: String(a.created_at),
        }))
      : [],
  };
}

export const TASK_SELECT_WITH_RELATIONS = `
  *,
  task_assignees ( user_id ),
  task_tag_links ( tag_id ),
  task_attachments (
    id,
    task_id,
    file_name,
    file_url,
    file_type,
    file_size,
    uploaded_by,
    created_at
  )
`;
