import type { AppPermissions } from './types';

/** Full task board admin: see/create/edit all tasks (from `can_administer_tasks`). */
export function isTaskSuperAdmin(permissions: Pick<AppPermissions, 'canAdministerTasks'>): boolean {
  return permissions.canAdministerTasks;
}
