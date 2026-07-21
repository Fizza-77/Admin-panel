import { supabase } from '@/lib/supabase/server';
import {
  isRlsPolicyError,
  isRpcNotFoundError,
  isUndefinedColumnError,
  rlsConfigurationHint,
  type DbErrorLike,
} from '@/lib/db/errors';
import { supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { reportError } from '@/lib/monitoring';

export type AppProfileRow = {
  can_manage_blogs: boolean;
  can_manage_tasks: boolean;
  can_administer_tasks: boolean;
  can_manage_users: boolean;
  can_manage_attendance: boolean;
  can_manage_expenses: boolean;
  can_manage_profiles: boolean;
  can_manage_payroll: boolean;
  display_name: string | null;
  surname: string | null;
  qualification: string | null;
  contact_info: string | null;
  company_role: string | null;
  salary: number | null;
  avatar_url: string | null;
};

const PROFILE_COLUMNS =
  'can_manage_blogs, can_manage_tasks, can_administer_tasks, can_manage_users, can_manage_attendance, can_manage_expenses, can_manage_profiles, can_manage_payroll, display_name, surname, qualification, contact_info, company_role, salary, avatar_url';

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
    can_manage_attendance:
      raw.can_manage_attendance !== null && raw.can_manage_attendance !== undefined
        ? Boolean(raw.can_manage_attendance)
        : false,
    can_manage_expenses:
      raw.can_manage_expenses !== null && raw.can_manage_expenses !== undefined
        ? Boolean(raw.can_manage_expenses)
        : false,
    can_manage_profiles:
      raw.can_manage_profiles !== null && raw.can_manage_profiles !== undefined
        ? Boolean(raw.can_manage_profiles)
        : false,
    can_manage_payroll:
      raw.can_manage_payroll !== null && raw.can_manage_payroll !== undefined
        ? Boolean(raw.can_manage_payroll)
        : false,
    display_name: typeof raw.display_name === 'string' ? raw.display_name : null,
    surname: typeof raw.surname === 'string' ? raw.surname : null,
    qualification: typeof raw.qualification === 'string' ? raw.qualification : null,
    contact_info: typeof raw.contact_info === 'string' ? raw.contact_info : null,
    company_role: typeof raw.company_role === 'string' ? raw.company_role : null,
    salary:
      raw.salary !== null && raw.salary !== undefined && Number.isFinite(Number(raw.salary))
        ? Number(raw.salary)
        : null,
    avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : null,
  };
}

export type ProfileFetchResult = {
  row: AppProfileRow | null;
  error: DbErrorLike | null;
};

export type UpsertProfileResult = { ok: true } | { ok: false; error: DbErrorLike };

export type AppProfileUpsertInput = {
  user_id: string;
  can_manage_blogs: boolean;
  can_manage_tasks: boolean;
  can_administer_tasks: boolean;
  can_manage_users: boolean;
  can_manage_attendance: boolean;
  can_manage_expenses: boolean;
  can_manage_profiles: boolean;
  can_manage_payroll: boolean;
  display_name: string | null;
  avatar_url: string | null;
};

export const DEFAULT_APP_PROFILE_FLAGS = {
  can_manage_blogs: false,
  can_manage_tasks: true,
  can_administer_tasks: false,
  can_manage_users: false,
  can_manage_attendance: false,
  can_manage_expenses: false,
  can_manage_profiles: false,
  can_manage_payroll: false,
} as const;

export const FULL_ACCESS_PROFILE_FLAGS = {
  can_manage_blogs: true,
  can_manage_tasks: true,
  can_administer_tasks: true,
  can_manage_users: true,
  can_manage_attendance: true,
  can_manage_expenses: true,
  can_manage_profiles: true,
  can_manage_payroll: true,
} as const;

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

/** SECURITY DEFINER — bypasses RLS; preferred path for all profile reads. */
async function fetchAppProfileRowViaRpc(userId: string): Promise<ProfileFetchResult & { raw?: Record<string, unknown> }> {
  const { data, error } = await supabase.rpc('svc_get_app_profile', { p_user_id: userId });
  if (error) {
    return { row: null, error: enrichDbError(error) };
  }
  if (!data || typeof data !== 'object') {
    return { row: null, error: null };
  }
  const raw = data as Record<string, unknown>;
  return { row: normalizeProfileRow(raw), error: null, raw };
}

/** Direct table read — only when RPC migrations are not applied yet. */
async function fetchAppProfileRowDirect(userId: string): Promise<ProfileFetchResult> {
  const { data, error } = await supabase
    .from('app_profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isUndefinedColumnError(error)) {
      const { data: legacy, error: legacyErr } = await supabase
        .from('app_profiles')
        .select(
          'can_manage_blogs, can_manage_tasks, can_manage_users, can_manage_attendance, can_manage_expenses, display_name, surname, qualification, contact_info, company_role, salary, avatar_url',
        )
        .eq('user_id', userId)
        .maybeSingle();
      if (legacyErr) {
        if (isUndefinedColumnError(legacyErr)) {
          const { data: older, error: olderErr } = await supabase
            .from('app_profiles')
            .select('can_manage_blogs, can_manage_tasks, can_manage_users')
            .eq('user_id', userId)
            .maybeSingle();
          if (olderErr) {
            reportError(olderErr, { source: 'fetchAppProfileRowDirect', userId });
            return { row: null, error: enrichDbError(olderErr) };
          }
          if (!older) {
            return { row: null, error: null };
          }
          return { row: normalizeProfileRow(older as Record<string, unknown>), error: null };
        }
        reportError(legacyErr, { source: 'fetchAppProfileRowDirect', userId });
        return { row: null, error: enrichDbError(legacyErr) };
      }
      if (!legacy) {
        return { row: null, error: null };
      }
      return { row: normalizeProfileRow(legacy as Record<string, unknown>), error: null };
    }
    reportError(error, { source: 'fetchAppProfileRowDirect', userId });
    return { row: null, error: enrichDbError(error) };
  }

  if (!data) {
    return { row: null, error: null };
  }
  return { row: normalizeProfileRow(data as Record<string, unknown>), error: null };
}

/**
 * Loads profile flags. Prefers SECURITY DEFINER RPC, but falls back to a direct
 * table read when the RPC is an older definition that omits newer permission columns
 * (e.g. can_manage_profiles) so granted access is not silently dropped.
 */
export async function fetchAppProfileRow(userId: string): Promise<ProfileFetchResult> {
  const rpc = await fetchAppProfileRowViaRpc(userId);
  if (!rpc.error) {
    const raw = rpc.raw;
    const rpcOmitsNewerFlags =
      Boolean(raw) &&
      (!Object.prototype.hasOwnProperty.call(raw, 'can_manage_profiles') ||
        !Object.prototype.hasOwnProperty.call(raw, 'can_manage_payroll'));
    if (rpcOmitsNewerFlags) {
      const direct = await fetchAppProfileRowDirect(userId);
      if (!direct.error && direct.row) {
        return direct;
      }
    }
    return { row: rpc.row, error: null };
  }
  if (!isRpcNotFoundError(rpc.error)) {
    reportError(rpc.error, { source: 'fetchAppProfileRowViaRpc', userId });
    return rpc;
  }

  return fetchAppProfileRowDirect(userId);
}

async function upsertDefaultAppProfileViaRpc(userId: string): Promise<UpsertProfileResult> {
  const { error } = await supabase.rpc('svc_upsert_default_app_profile', { p_user_id: userId });
  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

async function upsertFullAccessAppProfileViaRpc(userId: string): Promise<UpsertProfileResult> {
  const { error } = await supabase.rpc('svc_upsert_full_access_app_profile', { p_user_id: userId });
  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

async function tryUpsertPayload(userId: string, payload: Record<string, unknown>): Promise<UpsertProfileResult> {
  const { error } = await supabase.from('app_profiles').upsert(payload, { onConflict: 'user_id' });
  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

async function upsertDefaultAppProfileDirect(userId: string): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const payloads = [
    { user_id: userId, ...DEFAULT_APP_PROFILE_FLAGS, updated_at },
    {
      user_id: userId,
      can_manage_blogs: false,
      can_manage_tasks: true,
      can_manage_users: false,
      updated_at,
    },
  ];

  let lastError: DbErrorLike | null = null;
  for (const payload of payloads) {
    const result = await tryUpsertPayload(userId, payload);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (!isUndefinedColumnError(result.error)) {
      reportError(result.error, { source: 'upsertDefaultAppProfileDirect', userId });
      return result;
    }
  }

  if (lastError) {
    reportError(lastError, { source: 'upsertDefaultAppProfileDirect.exhausted', userId });
  }
  return { ok: false, error: lastError ?? { message: 'Failed to upsert default profile' } };
}

async function upsertFullAccessAppProfileDirect(userId: string): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const payloads = [
    { user_id: userId, ...FULL_ACCESS_PROFILE_FLAGS, updated_at },
    { user_id: userId, can_manage_blogs: true, can_manage_tasks: true, can_manage_users: true, updated_at },
  ];

  let lastError: DbErrorLike | null = null;
  for (const payload of payloads) {
    const result = await tryUpsertPayload(userId, payload);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (!isUndefinedColumnError(result.error)) {
      reportError(result.error, { source: 'upsertFullAccessAppProfileDirect', userId });
      return result;
    }
  }

  if (lastError) {
    reportError(lastError, { source: 'upsertFullAccessAppProfileDirect.exhausted', userId });
  }
  return { ok: false, error: lastError ?? { message: 'Failed to upsert full-access profile' } };
}

async function upsertAppProfileRowViaRpc(input: AppProfileUpsertInput): Promise<UpsertProfileResult> {
  const { error } = await supabase.rpc('svc_upsert_app_profile', {
    p_user_id: input.user_id,
    p_can_manage_blogs: input.can_manage_blogs,
    p_can_manage_tasks: input.can_manage_tasks,
    p_can_administer_tasks: input.can_administer_tasks,
    p_can_manage_users: input.can_manage_users,
    p_can_manage_attendance: input.can_manage_attendance,
    p_can_manage_expenses: input.can_manage_expenses,
    p_can_manage_profiles: input.can_manage_profiles,
    p_can_manage_payroll: input.can_manage_payroll,
    p_display_name: input.display_name,
    p_avatar_url: input.avatar_url,
  });
  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

async function upsertAppProfileRowDirect(input: AppProfileUpsertInput): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const payloads: Record<string, unknown>[] = [
    { ...input, updated_at },
    {
      user_id: input.user_id,
      can_manage_blogs: input.can_manage_blogs,
      can_manage_tasks: input.can_manage_tasks,
      can_administer_tasks: input.can_administer_tasks,
      can_manage_users: input.can_manage_users,
      can_manage_attendance: input.can_manage_attendance,
      can_manage_expenses: input.can_manage_expenses,
      can_manage_profiles: input.can_manage_profiles,
      display_name: input.display_name,
      avatar_url: input.avatar_url,
      updated_at,
    },
    {
      user_id: input.user_id,
      can_manage_blogs: input.can_manage_blogs,
      can_manage_tasks: input.can_manage_tasks,
      can_administer_tasks: input.can_administer_tasks,
      can_manage_users: input.can_manage_users,
      can_manage_attendance: input.can_manage_attendance,
      can_manage_expenses: input.can_manage_expenses,
      display_name: input.display_name,
      avatar_url: input.avatar_url,
      updated_at,
    },
    {
      user_id: input.user_id,
      can_manage_blogs: input.can_manage_blogs,
      can_manage_tasks: input.can_manage_tasks,
      can_administer_tasks: input.can_administer_tasks,
      can_manage_users: input.can_manage_users,
      updated_at,
    },
    {
      user_id: input.user_id,
      can_manage_blogs: input.can_manage_blogs,
      can_manage_tasks: input.can_manage_tasks,
      can_manage_users: input.can_manage_users,
      updated_at,
    },
  ];

  let lastError: DbErrorLike | null = null;
  for (const payload of payloads) {
    const result = await tryUpsertPayload(input.user_id, payload);
    if (result.ok) {
      return result;
    }
    lastError = result.error;
    if (!isUndefinedColumnError(result.error)) {
      reportError(result.error, { source: 'upsertAppProfileRowDirect', userId: input.user_id });
      return result;
    }
  }

  if (lastError) {
    reportError(lastError, { source: 'upsertAppProfileRowDirect.exhausted', userId: input.user_id });
  }
  return { ok: false, error: lastError ?? { message: 'Failed to upsert profile' } };
}

/** Upsert permission flags for a user (user management create/update). */
export async function upsertAppProfileRow(input: AppProfileUpsertInput): Promise<UpsertProfileResult> {
  const rpc = await upsertAppProfileRowViaRpc(input);
  if (rpc.ok) {
    return rpc;
  }
  if (rpc.error && !isRpcNotFoundError(rpc.error)) {
    reportError(rpc.error, { source: 'upsertAppProfileRowViaRpc', userId: input.user_id });
    return rpc;
  }

  return upsertAppProfileRowDirect(input);
}

export type EmployeePersonalUpdate = {
  display_name?: string | null;
  surname?: string | null;
  qualification?: string | null;
  contact_info?: string | null;
};

export type EmployeeAdminUpdate = {
  company_role?: string | null;
  salary?: number | null;
};

async function patchProfileColumns(
  userId: string,
  patch: Record<string, unknown>,
): Promise<UpsertProfileResult> {
  const updated_at = new Date().toISOString();
  const { error } = await supabase
    .from('app_profiles')
    .update({ ...patch, updated_at })
    .eq('user_id', userId);

  if (!error) {
    return { ok: true };
  }
  return { ok: false, error: enrichDbError(error) };
}

/** Update user-editable profile fields (Profile page). */
export async function updateEmployeePersonalProfile(
  userId: string,
  fields: EmployeePersonalUpdate,
): Promise<UpsertProfileResult> {
  const patch: Record<string, unknown> = {};
  if (fields.display_name !== undefined) {
    patch.display_name = fields.display_name;
  }
  if (fields.surname !== undefined) {
    patch.surname = fields.surname;
  }
  if (fields.qualification !== undefined) {
    patch.qualification = fields.qualification;
  }
  if (fields.contact_info !== undefined) {
    patch.contact_info = fields.contact_info;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const { row } = await fetchAppProfileRow(userId);
  if (!row) {
    const bootstrap = await upsertDefaultAppProfile(userId);
    if (!bootstrap.ok) {
      return bootstrap;
    }
  }

  return patchProfileColumns(userId, patch);
}

/** Update profile photo URL (self or set-profiles admin). */
export async function updateEmployeeAvatarUrl(
  userId: string,
  avatar_url: string | null,
): Promise<UpsertProfileResult> {
  const { row } = await fetchAppProfileRow(userId);
  if (!row) {
    const bootstrap = await upsertDefaultAppProfile(userId);
    if (!bootstrap.ok) {
      return bootstrap;
    }
  }

  return patchProfileColumns(userId, { avatar_url });
}

/** Update admin-only employee fields (role, salary). */
export async function updateEmployeeAdminProfile(
  userId: string,
  fields: EmployeeAdminUpdate,
): Promise<UpsertProfileResult> {
  const patch: Record<string, unknown> = {};
  if (fields.company_role !== undefined) {
    patch.company_role = fields.company_role;
  }
  if (fields.salary !== undefined) {
    patch.salary = fields.salary;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: true };
  }

  const { row } = await fetchAppProfileRow(userId);
  if (!row) {
    const bootstrap = await upsertDefaultAppProfile(userId);
    if (!bootstrap.ok) {
      return bootstrap;
    }
  }

  return patchProfileColumns(userId, patch);
}

export async function upsertDefaultAppProfile(userId: string): Promise<UpsertProfileResult> {
  const rpc = await upsertDefaultAppProfileViaRpc(userId);
  if (rpc.ok) {
    return rpc;
  }
  if (rpc.error && !isRpcNotFoundError(rpc.error)) {
    reportError(rpc.error, { source: 'upsertDefaultAppProfileViaRpc', userId });
    return rpc;
  }

  return upsertDefaultAppProfileDirect(userId);
}

export async function upsertFullAccessAppProfile(userId: string): Promise<UpsertProfileResult> {
  const rpc = await upsertFullAccessAppProfileViaRpc(userId);
  if (rpc.ok) {
    return rpc;
  }
  if (rpc.error && !isRpcNotFoundError(rpc.error)) {
    reportError(rpc.error, { source: 'upsertFullAccessAppProfileViaRpc', userId });
    return rpc;
  }

  return upsertFullAccessAppProfileDirect(userId);
}

export type ProfilesBatchResult = {
  byUserId: Map<string, AppProfileRow>;
  error: DbErrorLike | null;
};

export async function fetchAppProfileRowsByUserIds(userIds: string[]): Promise<ProfilesBatchResult> {
  if (userIds.length === 0) {
    return { byUserId: new Map(), error: null };
  }

  const byUserId = new Map<string, AppProfileRow>();
  const CHUNK_SIZE = 100;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('app_profiles')
      .select(`user_id, ${PROFILE_COLUMNS}`)
      .in('user_id', chunk);

    if (error) {
      if (isUndefinedColumnError(error)) {
        const { data: legacy, error: legacyErr } = await supabase
          .from('app_profiles')
          .select('user_id, can_manage_blogs, can_manage_tasks, can_manage_users')
          .in('user_id', chunk);
        if (legacyErr) {
          reportError(legacyErr, { source: 'fetchAppProfileRowsByUserIds.legacy', chunkSize: chunk.length });
          return { byUserId, error: enrichDbError(legacyErr) };
        }
        for (const row of legacy ?? []) {
          byUserId.set(row.user_id as string, normalizeProfileRow(row as Record<string, unknown>));
        }
        continue;
      }
      reportError(error, { source: 'fetchAppProfileRowsByUserIds', chunkSize: chunk.length });
      return { byUserId, error: enrichDbError(error) };
    }

    for (const row of data ?? []) {
      byUserId.set(row.user_id as string, normalizeProfileRow(row as Record<string, unknown>));
    }
  }

  return { byUserId, error: null };
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
