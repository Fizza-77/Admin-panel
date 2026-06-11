import type { AppPermissions } from '@/lib/permissions/types';

/** Cached client snapshot — for UI only. Never used for server authorization. */
export type AdminClientSession = {
  userId: string;
  email: string | null;
  permissions: AppPermissions;
  savedAt: string;
};

export const ADMIN_SESSION_STORAGE_KEY = 'skyen_admin_session_v1';

export function pickBestPermissions(
  primary?: AppPermissions | null,
  fallback?: AppPermissions | null,
): AppPermissions | undefined {
  if (!primary && !fallback) {
    return undefined;
  }
  if (!primary) {
    return fallback ?? undefined;
  }
  if (!fallback) {
    return primary;
  }
  if (primary.profileLoadError && !fallback.profileLoadError) {
    return fallback;
  }
  if (fallback.profileLoadError && !primary.profileLoadError) {
    return primary;
  }
  return primary;
}

function isAppPermissions(value: unknown): value is AppPermissions {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const p = value as AppPermissions;
  return (
    typeof p.canManageBlogs === 'boolean' &&
    typeof p.canManageTasks === 'boolean' &&
    typeof p.canAdministerTasks === 'boolean' &&
    typeof p.canManageUsers === 'boolean' &&
    typeof p.isPrimaryAdmin === 'boolean'
  );
}

export function readAdminClientSession(): AdminClientSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as AdminClientSession;
    if (
      !parsed ||
      typeof parsed.userId !== 'string' ||
      !isAppPermissions(parsed.permissions) ||
      typeof parsed.savedAt !== 'string'
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      email: typeof parsed.email === 'string' ? parsed.email : null,
      permissions: parsed.permissions,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function saveAdminClientSession(session: Omit<AdminClientSession, 'savedAt'>): AdminClientSession {
  const payload: AdminClientSession = {
    ...session,
    savedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(payload));
  }
  return payload;
}

export function clearAdminClientSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  }
}
