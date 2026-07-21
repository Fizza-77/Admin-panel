export const TASK_STATUSES = ['to_do', 'in_progress', 'ready', 'closed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  to_do: 'To Do',
  in_progress: 'In Progress',
  ready: 'Ready for QA',
  closed: 'Closed',
};

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

/** Only tasks admins may move a task into Closed. */
export function canSetTaskStatus(
  status: TaskStatus,
  isTasksAdmin: boolean,
): boolean {
  if (status === 'closed') {
    return isTasksAdmin;
  }
  return true;
}
