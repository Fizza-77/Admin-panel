import { supabase } from '@/lib/supabase/server';
import { isRlsPolicyError, isUndefinedColumnError, rlsConfigurationHint, type DbErrorLike } from '@/lib/db/errors';
import { supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
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

const MINIMAL_COLUMNS = 'can_manage_blogs, can_manage_tasks, can_manage_users';

const SELECT_COLUMN_TIERS = [FULL_COLUMNS, LEGACY_COLUMNS, MINIMAL_COLUMNS] as const;

export function normalizeProfileRow(raw: Record<string, unknown>): AppProfileRow {
  const can_manage_users =
    raw.can_manage_users !== null && raw.can_manage_users !== undefined ? Boolean(raw.can_manage_users) : false;
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

async function selectProfileByColumns(userId: string, columns: string) {
  return supabase.from('app_profiles').select(columns).eq('user_id', userId).maybeSingle();
}

/** SECURITY DEFINER fallback — bypasses RLS when service_role JWT is correct. */
async function fetchAppProfileRowViaRpc(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase.rpc('svc_get_app_profile', { p_user_id: userId });
  if (error) {
    reportError(error, { source: 'fetchAppProfileRowViaRpc', userId });
    return { row: null, error: enrichDbError(error) };
  }
  if (!data || typeof data !== 'object') {
    return { row: null, error: null };
  }
  return { row: normalizeProfileRow(data as Record<string, unknown>), error: null };
}

async function upsertDefaultAppProfileViaRpc(userId: string): Promise<UpsertProfileResult> {
  const { error } = await supabase.rpc('svc_upsert_default_app_profile', { p_user_id: userId });
  if (!error) {
    return { ok: true };
  }
  reportError(error, { source: 'upsertDefaultAppProfileViaRpc', userId });
  return { ok: false, error: enrichDbError(error) };
}

export async function fetchAppProfileRow(userId: string): Promise<ProfileFetchResult> {
  let lastError: DbErrorLike | null = null;
  let sawRlsError = false;

  for (const columns of SELECT_COLUMN_TIERS) {
    const { data, error } = await selectProfileByColumns(userId, columns);
    if (!error) {
      const raw = data as unknown as Record<string, unknown> | null;
      if (raw) {
        return { row: normalizeProfileRow(raw), error: null };
      }
      continue;
    }
    lastError = error;
    if (isRlsPolicyError(error)) {
      sawRlsError = true;
      break;
    }
    if (isUndefinedColumnError(error)) {
      continue;
    }
    reportError(error, { source: 'fetchAppProfileRow', userId, columns });
    return { row: null, error: enrichDbError(error) };
  }

  if (sawRlsError || lastError) {
    const rpc = await fetchAppProfileRowViaRpc(userId);
    if (rpc.row || !rpc.error) {
      return rpc;
    }
    if (lastError) {
      reportError(lastError, { source: 'fetchAppProfileRow.exhausted', userId });
    }
    return {
      row: null,
      error: rpc.error ?? (lastError ? enrichDbError(lastError) : { message: 'Failed to load profile' }),
    };
  }

  return { row: null, error: null };
}

export type ProfilesBatchResult = {
  byUserId: Map<string, AppProfileRow>;
  error: DbErrorLike | null;
};

export async function fetchAppProfileRowsByUserIds(userIds: string[]): Promise<ProfilesBatchResult> {
  if (userIds.length === 0) {
    return { byUserId: new Map(), error: null };
  }

  let lastError: DbErrorLike | null = null;

  for (const columns of SELECT_COLUMN_TIERS) {
    const { data, error } = await supabase
      .from('app_profiles')
      .select(`user_id, ${columns}`)
      .in('user_id', userIds);

    if (!error) {
      const byUserId = new Map<string, AppProfileRow>();
      for (const p of (data ?? []) as unknown as Array<Record<string, unknown> & { user_id: string }>) {
        const { user_id, ...rest } = p;
        byUserId.set(user_id, normalizeProfileRow(rest));
      }
      return { byUserId, error: null };
    }

    lastError = error;
    if (isUndefinedColumnError(error)) {
      continue;
    }
    reportError(error, { source: 'fetchAppProfileRowsByUserIds', columns });
    return { byUserId: new Map(), error };
  }

  if (lastError) {
    reportError(lastError, { source: 'fetchAppProfileRowsByUserIds.exhausted' });
  }
  return { byUserId: new Map(), error: lastError };
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

type UpsertPayload = Record<string, unknown>;

function enrichDbError(error: DbErrorLike): DbErrorLike {
  if (isRlsPolicyError(error)) {
    const keyHint = supabaseServiceRoleKeyStatus.valid
      ? ''
      : ` ${supabaseServiceRoleKeyStatus.message ?? rlsConfigurationHint()}`;
    return {
      ...error,
      message: `${error.message ?? 'RLS policy violation'}.${keyHint}`,
    };
  }
  return error;
}

async function tryUpsertPayload(userId: string, payload: UpsertPayload): Promise<UpsertProfileResult> {
  const { error } = await supabase.from('app_profiles').upsert(payload, { onConflict: 'user_id' });
  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

export async function upsertDefaultAppProfile(userId: string): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const tiers: UpsertPayload[] = [
    { user_id: userId, ...DEFAULT_APP_PROFILE_FLAGS, updated_at },
    {
      user_id: userId,
      can_manage_blogs: DEFAULT_APP_PROFILE_FLAGS.can_manage_blogs,
      can_manage_tasks: DEFAULT_APP_PROFILE_FLAGS.can_manage_tasks,
      can_manage_users: DEFAULT_APP_PROFILE_FLAGS.can_manage_users,
      updated_at,
    },
    {
      user_id: userId,
      can_manage_blogs: DEFAULT_APP_PROFILE_FLAGS.can_manage_blogs,
      can_manage_tasks: DEFAULT_APP_PROFILE_FLAGS.can_manage_tasks,
      can_manage_users: DEFAULT_APP_PROFILE_FLAGS.can_manage_users,
    },
  ];

  let lastError: DbErrorLike | null = null;
  let sawRlsError = false;
  for (const payload of tiers) {
    const result = await tryUpsertPayload(userId, payload);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (isRlsPolicyError(result.error)) {
      sawRlsError = true;
      break;
    }
    if (!isUndefinedColumnError(result.error)) {
      reportError(result.error, { source: 'upsertDefaultAppProfile', userId });
      return result;
    }
  }

  if (sawRlsError || (lastError && isRlsPolicyError(lastError))) {
    const rpc = await upsertDefaultAppProfileViaRpc(userId);
    if (rpc.ok) {
      return rpc;
    }
    return rpc;
  }

  if (lastError) {
    reportError(lastError, { source: 'upsertDefaultAppProfile.exhausted', userId });
  }
  return { ok: false, error: lastError ?? { message: 'Failed to upsert default profile' } };
}

export async function upsertFullAccessAppProfile(userId: string): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const tiers: UpsertPayload[] = [
    { user_id: userId, ...FULL_ACCESS_PROFILE_FLAGS, updated_at },
    {
      user_id: userId,
      can_manage_blogs: true,
      can_manage_tasks: true,
      can_manage_users: true,
      updated_at,
    },
    {
      user_id: userId,
      can_manage_blogs: true,
      can_manage_tasks: true,
      can_manage_users: true,
    },
  ];

  let lastError: DbErrorLike | null = null;
  for (const payload of tiers) {
    const result = await tryUpsertPayload(userId, payload);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (!isUndefinedColumnError(result.error)) {
      reportError(result.error, { source: 'upsertFullAccessAppProfile', userId });
      return result;
    }
  }

  if (lastError) {
    reportError(lastError, { source: 'upsertFullAccessAppProfile.exhausted', userId });
  }
  return { ok: false, error: lastError ?? { message: 'Failed to upsert full-access profile' } };
}

export async function ensureAppProfileRowsForUserIds(userIds: string[]): Promise<{
  byUserId: Map<string, AppProfileRow>;
  error: DbErrorLike | null;
  createdUserIds: string[];
  stillMissingUserIds: string[];
}> {
  const initial = await fetchAppProfileRowsByUserIds(userIds);
  if (initial.error && initial.byUserId.size === 0) {
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
      error: initial.error,
      createdUserIds: [],
      stillMissingUserIds: [],
    };
  }

  const refetch = await fetchAppProfileRowsByUserIds(userIds);
  const merged = new Map(initial.byUserId);
  refetch.byUserId.forEach((row, id) => {
    merged.set(id, row);
  });

  const stillMissingUserIds = userIds.filter((id) => !merged.has(id));
  if (stillMissingUserIds.length > 0) {
    return {
      byUserId: merged,
      error: { message: `Profile rows still missing for ${stillMissingUserIds.length} user(s) after bootstrap` },
      createdUserIds,
      stillMissingUserIds,
    };
  }

  return {
    byUserId: merged,
    error: refetch.error,
    createdUserIds,
    stillMissingUserIds: [],
  };
}
