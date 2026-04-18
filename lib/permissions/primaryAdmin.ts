/**
 * Single primary admin from `ADMIN_OWNER_EMAIL` (normalized).
 * User management and tag creation are restricted to this account when the env is set.
 */
export function getPrimaryAdminEmailNormalized(): string | null {
  const e = process.env.ADMIN_OWNER_EMAIL?.trim().toLowerCase();
  return e || null;
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  const owner = getPrimaryAdminEmailNormalized();
  if (!owner) {
    return false;
  }
  const n = email?.trim().toLowerCase();
  return Boolean(n && n === owner);
}

/** When true, only `isPrimaryAdminEmail` may manage users / create tags; otherwise legacy `canManageUsers` applies. */
export function isPrimaryAdminEnforced(): boolean {
  return getPrimaryAdminEmailNormalized() !== null;
}
