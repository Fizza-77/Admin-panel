import type { AppPermissions } from './types';

/** When a route requires blogs but the user cannot manage blogs. */
export function redirectWhenBlogDenied(permissions: AppPermissions): string {
  if (permissions.canManageTasks) {
    return '/tasks';
  }
  return '/unauthorized';
}

/** When a route requires tasks but the user cannot manage tasks. */
export function redirectWhenTaskDenied(permissions: AppPermissions): string {
  if (permissions.canManageBlogs) {
    return '/';
  }
  return '/unauthorized';
}
