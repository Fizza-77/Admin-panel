import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/server';
import { formatDbError, isRpcNotFoundError, type DbErrorLike } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export type BlogWriteResult = { ok: true; id: string } | { ok: false; error: DbErrorLike };

function blogWriteError(error: PostgrestError | DbErrorLike, context: string): BlogWriteResult {
  reportError(error, { source: context });
  return { ok: false, error };
}

async function updateBlogDirect(
  blogId: string,
  siteId: string,
  row: Record<string, unknown>,
): Promise<BlogWriteResult> {
  const { error } = await supabase
    .from('blogs')
    .update(row)
    .eq('id', blogId)
    .eq('site_id', siteId);

  if (error) {
    return blogWriteError(error, 'updateBlogDirect');
  }

  const { data: verify, error: verifyError } = await supabase
    .from('blogs')
    .select('id,updated_at')
    .eq('id', blogId)
    .eq('site_id', siteId)
    .maybeSingle();

  if (verifyError) {
    return blogWriteError(verifyError, 'updateBlogDirect.verify');
  }

  if (!verify) {
    return {
      ok: false,
      error: { message: 'Blog update could not be verified after write' },
    };
  }

  return { ok: true, id: blogId };
}

async function updateBlogViaRpc(
  blogId: string,
  siteId: string,
  row: Record<string, unknown>,
): Promise<BlogWriteResult> {
  const { data, error } = await supabase.rpc('svc_update_blog', {
    p_blog_id: blogId,
    p_site_id: siteId,
    p_row: row,
  });

  if (error) {
    return blogWriteError(error, 'updateBlogViaRpc');
  }

  if (!data) {
    return {
      ok: false,
      error: { message: 'svc_update_blog returned no id' },
    };
  }

  return { ok: true, id: String(data) };
}

export async function updateBlog(
  blogId: string,
  siteId: string,
  row: Record<string, unknown>,
): Promise<BlogWriteResult> {
  const rpc = await updateBlogViaRpc(blogId, siteId, row);
  if (rpc.ok) {
    return rpc;
  }
  if (!isRpcNotFoundError(rpc.error)) {
    return rpc;
  }

  return updateBlogDirect(blogId, siteId, row);
}

async function insertBlogViaRpc(row: Record<string, unknown>): Promise<BlogWriteResult> {
  const { data, error } = await supabase.rpc('svc_insert_blog', { p_row: row });

  if (error) {
    return blogWriteError(error, 'insertBlogViaRpc');
  }

  if (!data) {
    return {
      ok: false,
      error: { message: 'svc_insert_blog returned no id' },
    };
  }

  return { ok: true, id: String(data) };
}

async function insertBlogDirect(row: Record<string, unknown>): Promise<BlogWriteResult> {
  const { data, error } = await supabase.from('blogs').insert([row]).select('id').single();

  if (error) {
    return blogWriteError(error, 'insertBlogDirect');
  }

  if (!data?.id) {
    return {
      ok: false,
      error: { message: 'Blog insert returned no id' },
    };
  }

  return { ok: true, id: String(data.id) };
}

export async function insertBlog(row: Record<string, unknown>): Promise<BlogWriteResult> {
  const rpc = await insertBlogViaRpc(row);
  if (rpc.ok) {
    return rpc;
  }
  if (!isRpcNotFoundError(rpc.error)) {
    return rpc;
  }

  return insertBlogDirect(row);
}

async function deleteBlogViaRpc(blogId: string, siteId: string): Promise<BlogWriteResult> {
  const { data, error } = await supabase.rpc('svc_delete_blog', {
    p_blog_id: blogId,
    p_site_id: siteId,
  });

  if (error) {
    return blogWriteError(error, 'deleteBlogViaRpc');
  }

  if (!data) {
    return {
      ok: false,
      error: { message: 'svc_delete_blog returned no id' },
    };
  }

  return { ok: true, id: String(data) };
}

async function deleteBlogDirect(blogId: string, siteId: string): Promise<BlogWriteResult> {
  const { data, error } = await supabase
    .from('blogs')
    .delete()
    .eq('id', blogId)
    .eq('site_id', siteId)
    .select('id');

  if (error) {
    return blogWriteError(error, 'deleteBlogDirect');
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: { message: 'Blog delete matched 0 rows' },
    };
  }

  return { ok: true, id: blogId };
}

export async function deleteBlog(blogId: string, siteId: string): Promise<BlogWriteResult> {
  const rpc = await deleteBlogViaRpc(blogId, siteId);
  if (rpc.ok) {
    return rpc;
  }
  if (!isRpcNotFoundError(rpc.error)) {
    return rpc;
  }

  return deleteBlogDirect(blogId, siteId);
}

export function formatBlogWriteError(error: DbErrorLike): string {
  const message = formatDbError(error);
  if (/BLOG_UPDATE_NO_MATCH|BLOG_DELETE_NO_MATCH/i.test(message)) {
    return 'Blog not found for this site.';
  }
  if (isRpcNotFoundError(error)) {
    return (
      `${message}. Run supabase/migrations/20260623160000_svc_blog_writes.sql in the Supabase SQL Editor.`
    );
  }
  return message;
}
