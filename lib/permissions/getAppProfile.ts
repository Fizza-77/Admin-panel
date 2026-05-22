import { supabase } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';
import { isPrimaryAdminEmail, isPrimaryAdminEnforced } from './primaryAdmin';
import type { AppPermissions } from './types';

type BootstrapOwnerCache = { list: string[]; set: Set<string> };

let bootstrapOwnerCache: BootstrapOwnerCache | null = null;

function getBootstrapOwnerCache(): BootstrapOwnerCache {
  if (bootstrapOwnerCache) {
    return bootstrapOwnerCache;
  }
  const fromList = (process.env.ADMIN_APP_OWNER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const single = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();
  const list = single && !fromList.includes(single) ? [...fromList, single] : fromList;
  bootstrapOwnerCache = { list, set: new Set(list) };
  return bootstrapOwnerCache;
}

/** Emails that receive a full-access `app_profiles` row on first login if none exists yet. */
export function parseBootstrapOwnerEmails(): string[] {
  return getBootstrapOwnerCache().list;
}

/** O(1) check; env is fixed at process start for typical Next.js deployments. */
export function isBootstrapOwnerEmail(email: string): boolean {
  const n = email.trim().toLowerCase();
  if (!n) {
    return false;
  }
  return getBootstrapOwnerCache().set.has(n);
}

function rowToPermissions(
  row: {
    can_manage_blogs: boolean;
    can_manage_tasks: boolean;
    can_administer_tasks?: boolean;
    can_manage_users: boolean;
    display_name?: string | null;
  },
  email: string | null | undefined,
): AppPermissions {
  const primary = isPrimaryAdminEmail(email);
  const administer = row.can_administer_tasks ?? false;
  return {
    canManageBlogs: row.can_manage_blogs,
    canManageTasks: row.can_manage_tasks,
    canAdministerTasks: primary ? true : administer,
    canManageUsers: row.can_manage_users,
    isPrimaryAdmin: primary,
    canAccessUserManagement: isPrimaryAdminEnforced() ? primary : row.can_manage_users,
    canCreateTaskTags: isPrimaryAdminEnforced() ? primary : administer,
    displayName: row.display_name ?? null,
  };
}

/**
 * Loads RBAC flags for a user. If no row exists and the user's email is listed in
 * `ADMIN_APP_OWNER_EMAILS` (comma-separated) or `ADMIN_OWNER_EMAIL` (single primary owner),
 * inserts a full-access profile once.
 */
function withAccountEmail(perms: AppPermissions, email: string | null | undefined): AppPermissions {
  const primary = isPrimaryAdminEmail(email);
  const tagCreators = isPrimaryAdminEnforced() ? primary : perms.canAdministerTasks;
  return {
    ...perms,
    isPrimaryAdmin: primary,
    canAccessUserManagement: isPrimaryAdminEnforced() ? primary : perms.canManageUsers,
    canCreateTaskTags: tagCreators,
    accountEmail: email?.trim() ?? null,
  };
}

export async function getAppProfile(
  userId: string,
  email: string | null | undefined,
): Promise<AppPermissions> {
  const { data, error } = await supabase
    .from('app_profiles')
    .select('can_manage_blogs, can_manage_tasks, can_administer_tasks, can_manage_users, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    reportError(error, { source: 'getAppProfile.select', userId });
    return withAccountEmail(
      {
        canManageBlogs: false,
        canManageTasks: false,
        canAdministerTasks: false,
        canManageUsers: false,
        isPrimaryAdmin: false,
        canAccessUserManagement: false,
        canCreateTaskTags: false,
      },
      email,
    );
  }

  if (data) {
    return withAccountEmail(rowToPermissions(data, email), email);
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail && isBootstrapOwnerEmail(normalizedEmail)) {
    const { error: insertError } = await supabase.from('app_profiles').insert({
      user_id: userId,
      can_manage_blogs: true,
      can_manage_tasks: true,
      can_administer_tasks: true,
      can_manage_users: true,
    });
    if (insertError) {
      reportError(insertError, { source: 'getAppProfile.bootstrapInsert', userId });
      return withAccountEmail(
        {
          canManageBlogs: false,
          canManageTasks: false,
          canAdministerTasks: false,
          canManageUsers: false,
          isPrimaryAdmin: false,
          canAccessUserManagement: false,
          canCreateTaskTags: false,
        },
        email,
      );
    }
    return withAccountEmail(
      {
        canManageBlogs: true,
        canManageTasks: true,
        canAdministerTasks: true,
        canManageUsers: true,
        displayName: null,
        isPrimaryAdmin: isPrimaryAdminEmail(email),
        canAccessUserManagement: false,
        canCreateTaskTags: true,
      },
      email,
    );
  }

  return withAccountEmail(
    {
      canManageBlogs: false,
      canManageTasks: false,
      canAdministerTasks: false,
      canManageUsers: false,
      isPrimaryAdmin: false,
      canAccessUserManagement: false,
      canCreateTaskTags: false,
    },
    email,
  );
}
