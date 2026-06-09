import { supabase } from '@/lib/supabase/server';
import { formatDbError, isMissingColumnError, type DbErrorLike } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export type AppProfileRow = {
  can_manage_blogs: boolean;
  can_manage_tasks: boolean;
  can_administer_tasks: boolean;
  can_manage_users: boolean;
  display_name: string | null;
};

const FULL_COLUMNS =
  'can_manage_blogs, can_manage_tasks, can_administer_tasks, can_manage_users, display_name';

const LEGACY_COLUMNS = 'can_manage_blogs, can_manage_tasks, can_manage_users, display_name';

function isMissingAdministerColumn(error: DbErrorLike | null): boolean {
  return isMissingColumnError(error, 'can_administer_tasks');
}

export function normalizeProfileRow(raw: Record<string, unknown>): AppProfileRow {
  const can_manage_users = raw.can_manage_users !== null && raw.can_manage_users !== undefined
    ? Boolean(raw.can_manage_users)
    : false;
  const legacyAdminister =
    raw.can_administer_tasks !== undefined && raw.can_administer_tasks !== null
      ? Boolean(raw.can_administer_tasks)
      : can_manage_users;

  return {
    can_manage_blogs: Boolean(raw.can_manage_blogs),
    can_manage_tasks: Boolean(raw.can_manage_tasks) || legacyAdminister,
    can_administer_tasks: legacyAdminister,
    can_manage_users,
    display_name: typeof raw.display_name === 'string' ? raw.display_name : null,
  };
}

export type ProfileFetchResult = {
  row: AppProfileRow | null;
  error: DbErrorLike | null;
};

/** Load one profile row; falls back when `can_administer_tasks` column is not migrated yet. */
export async function fetchAppProfileRow(userId: string): Promise<ProfileFetchResult> {
  const full = await supabase.from('app_profiles').select(FULL_COLUMNS).eq('user_id', userId).maybeSingle();

  if (!full.error) {
    return {
      row: full.data ? normalizeProfileRow(full.data as Record<string, unknown>) : null,
      error: null,
    };
  }

  if (!isMissingAdministerColumn(full.error)) {
    reportError(full.error, { source: 'fetchAppProfileRow.full', userId });
    return { row: null, error: full.error };
  }

  const legacy = await supabase.from('app_profiles').select(LEGACY_COLUMNS).eq('user_id', userId).maybeSingle();

  if (legacy.error) {
    reportError(legacy.error, { source: 'fetchAppProfileRow.legacy', userId });
    return { row: null, error: legacy.error };
  }

  return {
    row: legacy.data ? normalizeProfileRow(legacy.data as Record<string, unknown>) : null,
    error: null,
  };
}

export type ProfilesBatchResult = {
  byUserId: Map<string, AppProfileRow>;
  error: DbErrorLike | null;
};

/** Load profiles for many users (user management table). */
export async function fetchAppProfileRowsByUserIds(userIds: string[]): Promise<ProfilesBatchResult> {
  if (userIds.length === 0) {
    return { byUserId: new Map(), error: null };
  }

  const full = await supabase.from('app_profiles').select(`user_id, ${FULL_COLUMNS}`).in('user_id', userIds);

  if (!full.error) {
    const byUserId = new Map<string, AppProfileRow>();
    for (const p of full.data ?? []) {
      const { user_id, ...rest } = p as Record<string, unknown> & { user_id: string };
      byUserId.set(user_id, normalizeProfileRow(rest));
    }
    return { byUserId, error: null };
  }

  if (!isMissingAdministerColumn(full.error)) {
    reportError(full.error, { source: 'fetchAppProfileRowsByUserIds.full' });
    return { byUserId: new Map(), error: full.error };
  }

  const legacy = await supabase.from('app_profiles').select(`user_id, ${LEGACY_COLUMNS}`).in('user_id', userIds);

  if (legacy.error) {
    reportError(legacy.error, { source: 'fetchAppProfileRowsByUserIds.legacy' });
    return { byUserId: new Map(), error: legacy.error };
  }

  const byUserId = new Map<string, AppProfileRow>();
  for (const p of legacy.data ?? []) {
    const { user_id, ...rest } = p as Record<string, unknown> & { user_id: string };
    byUserId.set(user_id, normalizeProfileRow(rest));
  }
  return { byUserId, error: null };
}

export const DEFAULT_APP_PROFILE_FLAGS = {
  can_manage_blogs: false,
  can_manage_tasks: true,
  can_administer_tasks: false,
  can_manage_users: false,
} as const;

export const FULL_ACCESS_PROFILE_FLAGS = {
  can_manage_blogs: true,
  can_manage_tasks: true,
  can_administer_tasks: true,
  can_manage_users: true,
} as const;

export type UpsertProfileResult = { ok: true } | { ok: false; error: DbErrorLike };

/** Create or update a profile row with default task access. */
export async function upsertDefaultAppProfile(userId: string): Promise<UpsertProfileResult> {
  const payload = {
    user_id: userId,
    ...DEFAULT_APP_PROFILE_FLAGS,
    updated_at: new Date().toISOString(),
  };

  const full = await supabase.from('app_profiles').upsert(payload, { onConflict: 'user_id' });
  if (!full.error) {
    return { ok: true };
  }

  if (!isMissingAdministerColumn(full.error)) {
    reportError(full.error, { source: 'upsertDefaultAppProfile.full', userId });
    return { ok: false, error: full.error };
  }

  const legacy = await supabase.from('app_profiles').upsert(
    {
      user_id: userId,
      can_manage_blogs: DEFAULT_APP_PROFILE_FLAGS.can_manage_blogs,
      can_manage_tasks: DEFAULT_APP_PROFILE_FLAGS.can_manage_tasks,
      can_manage_users: DEFAULT_APP_PROFILE_FLAGS.can_manage_users,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (legacy.error) {
    reportError(legacy.error, { source: 'upsertDefaultAppProfile.legacy', userId });
    return { ok: false, error: legacy.error };
  }

  return { ok: true };
}

/** Create a full-access profile row for bootstrap owners. */
export async function upsertFullAccessAppProfile(userId: string): Promise<UpsertProfileResult> {
  const payload = {
    user_id: userId,
    ...FULL_ACCESS_PROFILE_FLAGS,
    updated_at: new Date().toISOString(),
  };

  const full = await supabase.from('app_profiles').upsert(payload, { onConflict: 'user_id' });
  if (!full.error) {
    return { ok: true };
  }

  if (!isMissingAdministerColumn(full.error)) {
    reportError(full.error, { source: 'upsertFullAccessAppProfile.full', userId });
    return { ok: false, error: full.error };
  }

  const legacy = await supabase.from('app_profiles').upsert(
    {
      user_id: userId,
      can_manage_blogs: true,
      can_manage_tasks: true,
      can_manage_users: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  if (legacy.error) {
    reportError(legacy.error, { source: 'upsertFullAccessAppProfile.legacy', userId });
    return { ok: false, error: legacy.error };
  }

  return { ok: true };
}

/**
 * Ensure every user id has an `app_profiles` row.
 * Creates default rows for any missing users, then re-fetches.
 */
export async function ensureAppProfileRowsForUserIds(userIds: string[]): Promise<{
  byUserId: Map<string, AppProfileRow>;
  error: DbErrorLike | null;
  createdUserIds: string[];
  stillMissingUserIds: string[];
}> {
  const initial = await fetchAppProfileRowsByUserIds(userIds);
  if (initial.error) {
    return {
      byUserId: initial.byUserId,
      error: initial.error,
      createdUserIds: [],
      stillMissingUserIds: userIds,
    };
  }

  const missing = userIds.filter((id) => !initial.byUserId.has(id));
  const createdUserIds: string[] = [];

  for (const userId of missing) {
    const result = await upsertDefaultAppProfile(userId);
    if (result.ok) {
      createdUserIds.push(userId);
    } else {
      return {
        byUserId: initial.byUserId,
        error: result.error,
        createdUserIds,
        stillMissingUserIds: missing.filter((id) => !createdUserIds.includes(id)),
      };
    }
  }

  if (createdUserIds.length === 0) {
    return {
      byUserId: initial.byUserId,
      error: null,
      createdUserIds: [],
      stillMissingUserIds: [],
    };
  }

  const refetch = await fetchAppProfileRowsByUserIds(userIds);
  if (refetch.error) {
    return {
      byUserId: refetch.byUserId,
      error: refetch.error,
      createdUserIds,
      stillMissingUserIds: userIds.filter((id) => !refetch.byUserId.has(id)),
    };
  }

  const stillMissingUserIds = userIds.filter((id) => !refetch.byUserId.has(id));
  if (stillMissingUserIds.length > 0) {
    return {
      byUserId: refetch.byUserId,
      error: { message: `Profile rows still missing for ${stillMissingUserIds.length} user(s) after bootstrap` },
      createdUserIds,
      stillMissingUserIds,
    };
  }

  return {
    byUserId: refetch.byUserId,
    error: null,
    createdUserIds,
    stillMissingUserIds: [],
  };
}
