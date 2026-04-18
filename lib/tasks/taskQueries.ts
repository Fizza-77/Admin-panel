import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';

/**
 * Task ids where `userId` is an assignee (for visibility rules).
 */
export async function getTaskIdsAssignedToUser(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('task_assignees').select('task_id').eq('user_id', userId);

  if (error) {
    reportError(error, { source: 'getTaskIdsAssignedToUser' });
    return [];
  }

  return (data ?? []).map((r) => r.task_id).filter(Boolean);
}

/**
 * Non-admin users only see: workspace tasks, tasks they created, or private tasks they are assigned to.
 */
export function orFilterForVisibleTasks(userId: string, assigneeTaskIds: string[]): string {
  const parts = [`visibility.eq.workspace`, `created_by.eq.${userId}`];
  if (assigneeTaskIds.length > 0) {
    parts.push(`id.in.(${assigneeTaskIds.join(',')})`);
  }
  return parts.join(',');
}
