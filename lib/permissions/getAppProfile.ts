import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import {
  DEFAULT_APP_PROFILE_FLAGS,
  fetchAppProfileRow,
  FULL_ACCESS_PROFILE_FLAGS,
  upsertDefaultAppProfile,
  upsertFullAccessAppProfile,
  type AppProfileRow,
} from './appProfileDb';
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

export type AppProfileResult = {
  permissions: AppPermissions;
  /** Non-null when the permission query or bootstrap failed — never treat as "no access". */
  loadError: string | null;
};

function primaryAdminPermissions(displayName: string | null = null): AppPermissions {
  return {
    canManageBlogs: true,
    canManageTasks: true,
    canAdministerTasks: true,
    canManageUsers: true,
    isPrimaryAdmin: true,
    canAccessUserManagement: true,
    canCreateTaskTags: true,
    displayName,
    profileLoadError: null,
  };
}

function rowToPermissions(row: AppProfileRow, email: string | null | undefined): AppPermissions {
  if (isPrimaryAdminEmail(email)) {
    return { ...primaryAdminPermissions(row.display_name), accountEmail: email?.trim() ?? null };
  }

  const administer = row.can_administer_tasks;
  const canManageTasks = row.can_manage_tasks || administer;

  return {
    canManageBlogs: row.can_manage_blogs,
    canManageTasks,
    canAdministerTasks: administer,
    canManageUsers: row.can_manage_users,
    isPrimaryAdmin: false,
    canAccessUserManagement: isPrimaryAdminEnforced() ? false : row.can_manage_users,
    canCreateTaskTags: isPrimaryAdminEnforced() ? false : administer,
    displayName: row.display_name ?? null,
    profileLoadError: null,
  };
}

function withAccountEmail(perms: AppPermissions, email: string | null | undefined): AppPermissions {
  const primary = isPrimaryAdminEmail(email);
  if (primary) {
    return {
      ...primaryAdminPermissions(perms.displayName),
      accountEmail: email?.trim() ?? null,
      profileLoadError: perms.profileLoadError ?? null,
    };
  }
  const tagCreators = isPrimaryAdminEnforced() ? false : perms.canAdministerTasks;
  return {
    ...perms,
    isPrimaryAdmin: false,
    canAccessUserManagement: isPrimaryAdminEnforced() ? false : perms.canManageUsers,
    canCreateTaskTags: tagCreators,
    accountEmail: email?.trim() ?? null,
  };
}

function permissionsWithLoadError(
  email: string | null | undefined,
  loadError: string,
  displayName: string | null = null,
): AppPermissions {
  if (isPrimaryAdminEmail(email)) {
    return {
      ...primaryAdminPermissions(displayName),
      accountEmail: email?.trim() ?? null,
      profileLoadError: loadError,
    };
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
      displayName,
      profileLoadError: loadError,
    },
    email,
  );
}

async function ensureProfileRowForUser(
  userId: string,
  email: string | null | undefined,
): Promise<AppProfileResult> {
  const normalizedEmail = email?.trim().toLowerCase();

  if (normalizedEmail && isBootstrapOwnerEmail(normalizedEmail)) {
    const upsert = await upsertFullAccessAppProfile(userId);
    if (!upsert.ok) {
      const msg = formatDbError(upsert.error);
      reportError(upsert.error, { source: 'getAppProfile.bootstrapUpsert', userId });
      return {
        permissions: permissionsWithLoadError(email, msg),
        loadError: msg,
      };
    }
  } else {
    const upsert = await upsertDefaultAppProfile(userId);
    if (!upsert.ok) {
      const msg = formatDbError(upsert.error);
      reportError(upsert.error, { source: 'getAppProfile.defaultUpsert', userId });
      return {
        permissions: permissionsWithLoadError(email, msg),
        loadError: msg,
      };
    }
  }

  const refetch = await fetchAppProfileRow(userId);
  if (refetch.row) {
    return {
      permissions: withAccountEmail(rowToPermissions(refetch.row, email), email),
      loadError: null,
    };
  }

  // Upsert succeeded — use intended defaults if read still fails (partial schema).
  const isBootstrap = Boolean(normalizedEmail && isBootstrapOwnerEmail(normalizedEmail));
  const fallbackRow: AppProfileRow = isBootstrap
    ? {
        can_manage_blogs: FULL_ACCESS_PROFILE_FLAGS.can_manage_blogs,
        can_manage_tasks: FULL_ACCESS_PROFILE_FLAGS.can_manage_tasks,
        can_administer_tasks: FULL_ACCESS_PROFILE_FLAGS.can_administer_tasks,
        can_manage_users: FULL_ACCESS_PROFILE_FLAGS.can_manage_users,
        display_name: null,
      }
    : {
        can_manage_blogs: DEFAULT_APP_PROFILE_FLAGS.can_manage_blogs,
        can_manage_tasks: DEFAULT_APP_PROFILE_FLAGS.can_manage_tasks,
        can_administer_tasks: DEFAULT_APP_PROFILE_FLAGS.can_administer_tasks,
        can_manage_users: DEFAULT_APP_PROFILE_FLAGS.can_manage_users,
        display_name: null,
      };

  if (refetch.error) {
    reportError(refetch.error, { source: 'getAppProfile.refetchAfterUpsert', userId, note: 'using defaults' });
  } else {
    reportError(new Error('Profile row missing after upsert; using defaults'), {
      source: 'getAppProfile.missingAfterUpsert',
      userId,
    });
  }

  return {
    permissions: withAccountEmail(rowToPermissions(fallbackRow, email), email),
    loadError: null,
  };
}

/**
 * Loads RBAC flags for a user. Missing rows are bootstrapped automatically.
 * Query failures return `loadError` instead of silently denying access.
 */
export async function getAppProfile(
  userId: string,
  email: string | null | undefined,
): Promise<AppProfileResult> {
  if (isPrimaryAdminEmail(email)) {
    const { row, error } = await fetchAppProfileRow(userId);
    if (!error) {
      return {
        permissions: withAccountEmail(
          row ? rowToPermissions(row, email) : primaryAdminPermissions(),
          email,
        ),
        loadError: null,
      };
    }
    const msg = formatDbError(error);
    reportError(error, { source: 'getAppProfile.primaryFallback', userId });
    return {
      permissions: permissionsWithLoadError(email, msg),
      loadError: msg,
    };
  }

  const { row, error } = await fetchAppProfileRow(userId);

  if (error) {
    const msg = formatDbError(error);
    reportError(error, { source: 'getAppProfile.select', userId });
    return {
      permissions: permissionsWithLoadError(email, msg),
      loadError: msg,
    };
  }

  if (row) {
    return {
      permissions: withAccountEmail(rowToPermissions(row, email), email),
      loadError: null,
    };
  }

  return ensureProfileRowForUser(userId, email);
}

/**
 * Ensure every logged-in user has an `app_profiles` row (basic task access by default).
 * Best-effort: returns `ok: false` only when bootstrap could not write a row at all.
 */
export async function ensureAppProfileRow(userId: string): Promise<{ ok: boolean; error: string | null }> {
  const { row, error } = await fetchAppProfileRow(userId);
  if (row) {
    return { ok: true, error: null };
  }

  if (error) {
    reportError(error, { source: 'ensureAppProfileRow.read', userId });
    // Row may still be absent — attempt insert below.
  }

  const upsert = await upsertDefaultAppProfile(userId);
  if (!upsert.ok) {
    reportError(upsert.error, { source: 'ensureAppProfileRow.upsert', userId });
    return { ok: false, error: formatDbError(upsert.error) };
  }

  const refetch = await fetchAppProfileRow(userId);
  if (refetch.row) {
    return { ok: true, error: null };
  }

  // Upsert succeeded but read still fails — row exists; permissions load may use fallbacks.
  if (refetch.error) {
    reportError(refetch.error, { source: 'ensureAppProfileRow.refetch', userId, note: 'upsert succeeded' });
    return { ok: true, error: null };
  }

  return { ok: false, error: 'Profile row missing after login bootstrap' };
}

