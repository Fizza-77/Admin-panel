import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { rlsConfigurationHint } from '@/lib/db/errors';

export type WriteMissDiagnosis = {
  status: number;
  message: string;
};

function sameUuid(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * When an UPDATE/DELETE matches 0 rows, distinguish missing blog, wrong site, and blocked writes.
 * The generic "Blog not found" hid cases where the row exists but Postgres rejected the write.
 */
export async function diagnoseBlogWriteMiss(
  blogId: string,
  siteId: string,
  action: 'update' | 'delete',
): Promise<WriteMissDiagnosis> {
  const { data: row, error } = await supabase
    .from('blogs')
    .select('id,site_id')
    .eq('id', blogId)
    .maybeSingle();

  if (error) {
    return {
      status: 500,
      message: `Could not verify blog before ${action}: ${error.message}`,
    };
  }

  if (!row) {
    return { status: 404, message: 'Blog not found' };
  }

  if (!sameUuid(String(row.site_id), siteId)) {
    return {
      status: 409,
      message:
        'This blog belongs to a different site than the URL. Open it again from Sites → View blogs.',
    };
  }

  if (!supabaseServiceRoleKeyStatus.valid) {
    const hint = supabaseServiceRoleKeyStatus.message ?? rlsConfigurationHint();
    return {
      status: 503,
      message:
        `The blog exists but the ${action} did not apply. The server Supabase key is not a valid service_role JWT. ${hint}`,
    };
  }

  return {
    status: 503,
    message:
      `The blog exists but the ${action} did not apply (no rows changed). ` +
      'This is usually caused by row-level security blocking writes on the server database client. ' +
      'Confirm /api/health reports service_role_key.valid=true on this host, then retry.',
  };
}
