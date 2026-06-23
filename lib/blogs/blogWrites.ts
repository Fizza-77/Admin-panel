import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/server';
import {
  formatDbError,
  isRpcNotFoundError,
  isRlsPolicyError,
  type DbErrorLike,
} from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export type BlogWriteResult = { ok: true; id: string } | { ok: false; error: DbErrorLike };

const MIGRATION_HINT =
  'Run supabase/migrations/20260623160000_svc_blog_writes.sql in the Supabase SQL Editor, then retry.';

function blogWriteError(error: PostgrestError | DbErrorLike, context: string): BlogWriteResult {
  reportError(error, { source: context });
  return { ok: false, error };
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
      error: { message: `svc_update_blog returned no id. ${MIGRATION_HINT}` },
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

  if (isRpcNotFoundError(rpc.error)) {
    return {
      ok: false,
      error: {
        code: rpc.error.code ?? 'PGRST202',
        message: `Blog write function is not installed in Supabase. ${MIGRATION_HINT}`,
      },
    };
  }

  return rpc;
}

async function insertBlogViaRpc(row: Record<string, unknown>): Promise<BlogWriteResult> {
  const { data, error } = await supabase.rpc('svc_insert_blog', { p_row: row });

  if (error) {
    return blogWriteError(error, 'insertBlogViaRpc');
  }

  if (!data) {
    return {
      ok: false,
      error: { message: `svc_insert_blog returned no id. ${MIGRATION_HINT}` },
    };
  }

  return { ok: true, id: String(data) };
}

export async function insertBlog(row: Record<string, unknown>): Promise<BlogWriteResult> {
  const rpc = await insertBlogViaRpc(row);
  if (rpc.ok) {
    return rpc;
  }

  if (isRpcNotFoundError(rpc.error)) {
    return {
      ok: false,
      error: {
        code: rpc.error.code ?? 'PGRST202',
        message: `Blog write function is not installed in Supabase. ${MIGRATION_HINT}`,
      },
    };
  }

  return rpc;
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
      error: { message: `svc_delete_blog returned no id. ${MIGRATION_HINT}` },
    };
  }

  return { ok: true, id: String(data) };
}

export async function deleteBlog(blogId: string, siteId: string): Promise<BlogWriteResult> {
  const rpc = await deleteBlogViaRpc(blogId, siteId);
  if (rpc.ok) {
    return rpc;
  }

  if (isRpcNotFoundError(rpc.error)) {
    return {
      ok: false,
      error: {
        code: rpc.error.code ?? 'PGRST202',
        message: `Blog write function is not installed in Supabase. ${MIGRATION_HINT}`,
      },
    };
  }

  return rpc;
}

export function formatBlogWriteError(error: DbErrorLike): string {
  const message = formatDbError(error);

  if (/BLOG_SITE_MISMATCH/i.test(message)) {
    return 'This blog belongs to a different site. Open it again from Sites → View blogs.';
  }

  if (/BLOG_UPDATE_NO_MATCH|BLOG_DELETE_NO_MATCH/i.test(message)) {
    return 'Blog not found for this site.';
  }

  if (/Invalid category_id/i.test(message)) {
    return 'The selected category is invalid. Choose a category from the list or leave it empty.';
  }

  if (isRpcNotFoundError(error)) {
    return `Blog write function is not installed in Supabase. ${MIGRATION_HINT}`;
  }

  if (isRlsPolicyError(error)) {
    return `${message} ${MIGRATION_HINT}`;
  }

  return message;
}

export function blogWriteHttpStatus(error: DbErrorLike): number {
  if (/BLOG_SITE_MISMATCH|BLOG_UPDATE_NO_MATCH|BLOG_DELETE_NO_MATCH/i.test(error.message ?? '')) {
    return 404;
  }
  if (/Invalid category_id/i.test(error.message ?? '')) {
    return 400;
  }
  if (isRpcNotFoundError(error) || isRlsPolicyError(error)) {
    return 503;
  }
  return 500;
}
