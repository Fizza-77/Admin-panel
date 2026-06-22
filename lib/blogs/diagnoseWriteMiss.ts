import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { formatDbError, isRlsPolicyError, rlsConfigurationHint } from '@/lib/db/errors';
import { probeBlogWriteAccess } from '@/lib/blogs/probeBlogWriteAccess';

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

  const probeTimestamp = new Date().toISOString();
  const { data: probeRows, error: probeError } = await supabase
    .from('blogs')
    .update({ date_modified: probeTimestamp })
    .eq('id', blogId)
    .eq('site_id', siteId)
    .select('id');

  if (probeError) {
    const rlsHint = isRlsPolicyError(probeError)
      ? ` ${rlsConfigurationHint()}`
      : '';
    return {
      status: 503,
      message:
        `The blog exists but the ${action} did not apply: ${formatDbError(probeError)}.${rlsHint}`,
    };
  }

  if (!probeRows || probeRows.length === 0) {
    return {
      status: 503,
      message:
        `The blog exists but the ${action} did not apply (no rows changed). ` +
        'Row-level security or table grants are blocking writes. ' +
        'Run supabase/migrations/20260623150000_rls_definitive_reset.sql in the Supabase SQL Editor, ' +
        'then confirm /api/health reports blogs_write_probe.ok=true.',
    };
  }

  return {
    status: 500,
    message:
      `The blog exists and a minimal write succeeded, but the full ${action} did not apply. ` +
      'This usually means a column in the save payload is missing on the database or rejected by a constraint ' +
      '(for example date_modified, faq_schema, or category_id). Check the server log for the exact database error.',
  };
}
