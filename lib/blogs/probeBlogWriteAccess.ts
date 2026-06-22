import { supabase } from '@/lib/supabase/server';
import { formatDbError, isRlsPolicyError, rlsConfigurationHint } from '@/lib/db/errors';

export type BlogWriteProbeResult = {
  ok: boolean;
  error: string | null;
  blog_id: string | null;
};

/**
 * Attempt a minimal UPDATE on one blog row to verify the server client can write.
 * Used by /api/health and write-miss diagnostics.
 */
export async function probeBlogWriteAccess(): Promise<BlogWriteProbeResult> {
  const { data: sample, error: sampleError } = await supabase
    .from('blogs')
    .select('id,site_id')
    .limit(1)
    .maybeSingle();

  if (sampleError) {
    const msg = isRlsPolicyError(sampleError)
      ? `${formatDbError(sampleError)} — server cannot read blogs. ${rlsConfigurationHint()}`
      : formatDbError(sampleError);
    return { ok: false, error: msg, blog_id: null };
  }

  if (!sample) {
    return { ok: true, error: null, blog_id: null };
  }

  const { data, error } = await supabase
    .from('blogs')
    .update({ date_modified: new Date().toISOString() })
    .eq('id', sample.id)
    .eq('site_id', sample.site_id)
    .select('id');

  if (error) {
    const msg = isRlsPolicyError(error)
      ? `${formatDbError(error)} — blog writes blocked. Run the RLS reset migration in Supabase SQL Editor. ${rlsConfigurationHint()}`
      : formatDbError(error);
    return { ok: false, error: msg, blog_id: String(sample.id) };
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        'Blog write probe updated 0 rows (RLS or missing UPDATE grant on public.blogs). ' +
        'Run supabase/migrations/20260623150000_rls_definitive_reset.sql in Supabase SQL Editor.',
      blog_id: String(sample.id),
    };
  }

  return { ok: true, error: null, blog_id: String(sample.id) };
}
