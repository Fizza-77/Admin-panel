import { supabase } from '@/lib/supabase/server';
import { formatDbError, isRpcNotFoundError, isRlsPolicyError, rlsConfigurationHint } from '@/lib/db/errors';

export type BlogWriteProbeResult = {
  ok: boolean;
  error: string | null;
  blog_id: string | null;
};

async function probeBlogWriteViaRpc(): Promise<BlogWriteProbeResult | null> {
  const { data, error } = await supabase.rpc('svc_probe_blog_write');

  if (error) {
    if (isRpcNotFoundError(error)) {
      return null;
    }
    const msg = isRlsPolicyError(error)
      ? `${formatDbError(error)} — blog write RPC blocked. ${rlsConfigurationHint()}`
      : formatDbError(error);
    return { ok: false, error: msg, blog_id: null };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'svc_probe_blog_write returned invalid payload', blog_id: null };
  }

  const payload = data as { ok?: boolean; blog_id?: string | null; message?: string | null };
  return {
    ok: Boolean(payload.ok),
    error: payload.ok ? null : payload.message ?? 'Blog write probe failed',
    blog_id: payload.blog_id ? String(payload.blog_id) : null,
  };
}

/**
 * Attempt a minimal UPDATE on one blog row to verify the server client can write.
 * Prefers SECURITY DEFINER RPC; falls back to direct table update.
 */
export async function probeBlogWriteAccess(): Promise<BlogWriteProbeResult> {
  const rpcProbe = await probeBlogWriteViaRpc();
  if (rpcProbe) {
    return rpcProbe;
  }

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
      ? `${formatDbError(error)} — blog writes blocked. Run 20260623160000_svc_blog_writes.sql in Supabase SQL Editor. ${rlsConfigurationHint()}`
      : formatDbError(error);
    return { ok: false, error: msg, blog_id: String(sample.id) };
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error:
        'Blog write probe updated 0 rows. Run supabase/migrations/20260623160000_svc_blog_writes.sql in the Supabase SQL Editor.',
      blog_id: String(sample.id),
    };
  }

  return { ok: true, error: null, blog_id: String(sample.id) };
}
