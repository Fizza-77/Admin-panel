import type { PostgrestError } from '@supabase/supabase-js';

export type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

/** Serialize a Supabase/PostgREST error for logs and API responses. */
export function formatDbError(error: DbErrorLike | null | undefined): string {
  if (!error?.message) {
    return 'Unknown database error';
  }
  const parts = [error.message];
  if (error.code) {
    parts.push(`(code ${error.code})`);
  }
  if (error.details) {
    parts.push(`— ${error.details}`);
  }
  return parts.join(' ');
}

export function isPostgrestError(value: unknown): value is PostgrestError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as PostgrestError).message === 'string'
  );
}

/** Postgres undefined_column */
export function isUndefinedColumnError(error: DbErrorLike | null | undefined): boolean {
  return error?.code === '42703';
}

/** PostgREST / Postgres — RPC not deployed yet */
export function isRpcNotFoundError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false;
  }
  if (error.code === 'PGRST202' || error.code === '42883') {
    return true;
  }
  return /could not find the function|function.*does not exist/i.test(error.message ?? '');
}

/** Postgres insufficient_privilege / RLS violation */
export function isRlsPolicyError(error: DbErrorLike | null | undefined): boolean {
  if (!error) {
    return false;
  }
  if (error.code === '42501') {
    return true;
  }
  return /row-level security policy/i.test(error.message ?? '');
}

export function rlsConfigurationHint(): string {
  return (
    'Set SUPABASE_SERVICE_ROLE_KEY to the service_role secret from Supabase → Project Settings → API ' +
    '(not the anon/public key), then: pm2 delete admin-panel && pm2 start ecosystem.config.cjs && pm2 save'
  );
}

export function apiErrorFromDbError(
  error: DbErrorLike,
  context: string,
): { status: number; message: string } {
  if (isRlsPolicyError(error)) {
    return {
      status: 503,
      message:
        `${formatDbError(error)} (${context}). ` +
        'The admin server is not using the Supabase service_role key, so Postgres RLS blocks writes. ' +
        rlsConfigurationHint(),
    };
  }
  return { status: 500, message: formatDbError(error) };
}

export function isMissingColumnError(error: DbErrorLike | null | undefined, columnName: string): boolean {
  if (!error) {
    return false;
  }
  if (isUndefinedColumnError(error)) {
    return true;
  }
  const pattern = new RegExp(columnName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return pattern.test(error.message ?? '');
}

export type DataLoadState<T> =
  | { ok: true; data: T; warning: string | null }
  | { ok: false; data: T; error: string; dbError: DbErrorLike | null };

export function dataLoadSuccess<T>(data: T, warning: string | null = null): DataLoadState<T> {
  return { ok: true, data, warning };
}

export function dataLoadFailure<T>(emptyValue: T, error: DbErrorLike, dbError: DbErrorLike | null = error): DataLoadState<T> {
  return { ok: false, data: emptyValue, error: formatDbError(error), dbError };
}
