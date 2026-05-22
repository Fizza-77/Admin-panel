export type AppPermissions = {
  canManageBlogs: boolean;
  /** Basic task board access (assigned + workspace tasks). */
  canManageTasks: boolean;
  /** Create/edit all tasks, tags, and filters (user management checkbox). */
  canAdministerTasks: boolean;
  canManageUsers: boolean;
  /** True when session email matches `ADMIN_OWNER_EMAIL` (if set). */
  isPrimaryAdmin: boolean;
  /** User management UI/API: primary admin only when `ADMIN_OWNER_EMAIL` is set; otherwise `canManageUsers`. */
  canAccessUserManagement: boolean;
  /** Create task tags: primary admin when enforced; otherwise users with Tasks (full) access. */
  canCreateTaskTags: boolean;
  /** From `app_profiles.display_name`; UI falls back to email when null */
  displayName?: string | null;
  /** Signed-in user email (session) for header / settings */
  accountEmail?: string | null;
};
