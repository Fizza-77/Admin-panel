export type AppPermissions = {
  canManageBlogs: boolean;
  canManageTasks: boolean;
  canManageUsers: boolean;
  /** True when session email matches `ADMIN_OWNER_EMAIL` (if set). */
  isPrimaryAdmin: boolean;
  /** User management UI/API: primary admin only when `ADMIN_OWNER_EMAIL` is set; otherwise `canManageUsers`. */
  canAccessUserManagement: boolean;
  /** Create task tags: primary admin only when `ADMIN_OWNER_EMAIL` is set; otherwise `canManageUsers`. */
  canCreateTaskTags: boolean;
  /** From `app_profiles.display_name`; UI falls back to email when null */
  displayName?: string | null;
  /** Signed-in user email (session) for header / settings */
  accountEmail?: string | null;
};
