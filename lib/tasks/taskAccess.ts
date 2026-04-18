import type { TaskRow } from './taskRow';

export function canUserViewTask(
  task: Pick<TaskRow, 'visibility' | 'created_by'>,
  userId: string,
  isSuperAdmin: boolean,
  assigneeIds: string[],
): boolean {
  if (isSuperAdmin) {
    return true;
  }
  if (task.visibility === 'workspace') {
    return true;
  }
  if (task.created_by === userId) {
    return true;
  }
  return assigneeIds.includes(userId);
}

export function canUserFullyManageTask(
  task: Pick<TaskRow, 'created_by'>,
  userId: string,
  isSuperAdmin: boolean,
): boolean {
  return isSuperAdmin || task.created_by === userId;
}

/** Assignee (not creator / not super-admin) may only change status. */
export function assigneeStatusOnly(
  task: Pick<TaskRow, 'created_by'>,
  userId: string,
  isSuperAdmin: boolean,
  assigneeIds: string[],
): boolean {
  if (isSuperAdmin) {
    return false;
  }
  if (task.created_by === userId) {
    return false;
  }
  return assigneeIds.includes(userId);
}
