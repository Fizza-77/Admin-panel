export type ServiceRoleKeyStatus = {
  valid: boolean;
  role: string | null;
  matchesAnonKey: boolean;
  message: string | null;
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Verify the server key is the Supabase service_role JWT, not the public anon key. */
export function inspectServiceRoleKey(serviceKey: string, anonKey: string): ServiceRoleKeyStatus {
  if (!serviceKey.trim()) {
    return {
      valid: false,
      role: null,
      matchesAnonKey: false,
      message: 'SUPABASE_SERVICE_ROLE_KEY is empty',
    };
  }

  if (serviceKey === anonKey) {
    return {
      valid: false,
      role: 'anon',
      matchesAnonKey: true,
      message:
        'SUPABASE_SERVICE_ROLE_KEY is set to the anon key. Use the service_role secret from Supabase → Settings → API.',
    };
  }

  const payload = decodeJwtPayload(serviceKey);
  if (!payload) {
    return {
      valid: false,
      role: null,
      matchesAnonKey: false,
      message: 'SUPABASE_SERVICE_ROLE_KEY is not a valid JWT',
    };
  }

  const role = typeof payload.role === 'string' ? payload.role : null;
  if (role !== 'service_role') {
    return {
      valid: false,
      role,
      matchesAnonKey: false,
      message: `SUPABASE_SERVICE_ROLE_KEY has JWT role "${role ?? 'unknown'}", expected "service_role"`,
    };
  }

  return { valid: true, role, matchesAnonKey: false, message: null };
}

export function assertValidServiceRoleKey(serviceKey: string, anonKey: string): void {
  const status = inspectServiceRoleKey(serviceKey, anonKey);
  if (!status.valid) {
    throw new Error(
      `Invalid Supabase server configuration: ${status.message}. ` +
        'Profile and permission queries will fail with RLS errors until this is fixed.',
    );
  }
}
