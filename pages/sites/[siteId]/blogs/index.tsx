import Head from 'next/head';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import { setupUnlockHref } from '@/lib/setup';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogReactions from '@/components/BlogReactions';
import { supabase } from '@/lib/supabase/server';
import { listBlogsForSite } from '@/lib/blogs/listBlogsForSite';
import DataLoadError from '@/components/ui/DataLoadError';
import { PlusCircle, Search, Edit2, Trash2, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { Site } from '@/types/site';
import { reportError } from '@/lib/monitoring';
import type { AppPermissions } from '@/lib/permissions/types';
import { EMPTY_REACTION_COUNTS, toReactionCounts, type ReactionCounts } from '@/lib/blogs/reactions';

type Blog = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  description: string | null;
  slug: string;
  cover_image_url: string | null;
  date_published: string | null;
  date_modified: string | null;
  main_entity_of_page: string | null;
};

interface SiteBlogsPageProps {
  site: Site;
  blogs: Blog[];
  reactionCountsByBlog: Record<string, ReactionCounts>;
  blogsLoadError: string | null;
  blogsLoadWarning: string | null;
  permissions: AppPermissions;
}

export const getServerSideProps = requireAuthentication(
  requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
  const { siteId } = context.params as { siteId: string };

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id,name,domain,site_key')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return { notFound: true };
  }

  const blogsResult = await listBlogsForSite(site.id);
  const safeBlogs = blogsResult.data;
  const blogIds = safeBlogs.map((blog) => blog.id).filter(Boolean);
  const reactionCountsByBlog: Record<string, ReactionCounts> = {};

  if (blogIds.length > 0) {
    const { data: reactionRows, error: reactionError } = await supabase
      .from('blog_reaction_counts')
      .select('blog_id,love,thumbs_up,thumbs_down,celebrationpop,clap')
      .in('blog_id', blogIds);

    if (reactionError) {
      console.error('Error fetching reaction counts:', reactionError);
    }

    for (const blogId of blogIds) {
      reactionCountsByBlog[blogId] = { ...EMPTY_REACTION_COUNTS };
    }

    for (const row of reactionRows ?? []) {
      const id = row?.blog_id;
      if (typeof id === 'string' && reactionCountsByBlog[id]) {
        reactionCountsByBlog[id] = toReactionCounts(row as Partial<Record<keyof ReactionCounts, number>>);
      }
    }
  }

  return {
    props: {
      site,
      blogs: safeBlogs,
      reactionCountsByBlog,
      blogsLoadError: blogsResult.ok ? null : blogsResult.error,
      blogsLoadWarning: blogsResult.ok ? blogsResult.warning : null,
    },
  };
  }),
);

export default function SiteBlogsPage({
  site,
  blogs,
  reactionCountsByBlog,
  blogsLoadError,
  blogsLoadWarning,
  permissions,
}: SiteBlogsPageProps) {
  const router = useRouter();
  const [deletingBlogId, setDeletingBlogId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const safeBlogs = Array.isArray(blogs) ? blogs : [];

  const formatDisplayDate = (input: string | null) => {
    if (!input) return null;
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    try {
      return format(parsed, 'MMM d, yyyy');
    } catch {
      return null;
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeletingBlogId(pendingDelete.id);
    try {
      const response = await fetch(`/api/sites/${site.id}/blogs/${pendingDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete blog');
      }

      await router.replace(router.asPath);
      setPendingDelete(null);
      setDeleteError(null);
    } catch (error: any) {
      reportError(error, {
        source: 'SiteBlogsPage.handleDelete',
        siteId: site?.id ?? null,
        blogId: pendingDelete.id,
      });
      setDeleteError(error?.message || 'Failed to delete blog');
    } finally {
      setDeletingBlogId(null);
    }
  };

  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Blogs - {site.name || site.domain || site.site_key} | Skyen Blog Admin</title>
      </Head>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-1">Website</p>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{site.name || site.domain || site.site_key}</h1>
          <p className="text-gray-500 mt-1">
            Manage blog posts for{' '}
            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{site.site_key}</span>.
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3">
          <Link
            href={setupUnlockHref(`/sites/${site.id}/setup`)}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium py-2 px-3 sm:px-4 rounded-lg border border-indigo-200 transition text-sm"
          >
            Setup
          </Link>
          <Link
            href={`/sites/${site.id}/blogs/create`}
            className="flex-1 sm:flex-none justify-center flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 sm:px-4 rounded-lg transition shadow-sm text-sm"
          >
            <PlusCircle className="w-5 h-5" />
            Add Blog
          </Link>
        </div>
      </div>

      <div className="mb-6 relative w-full md:max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search blogs..."
          // Client-side search can be added later; for now this is just UI-ready.
          readOnly
        />
      </div>
      {deleteError && (
        <div className="mb-6 border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
          {deleteError}
        </div>
      )}

      {blogsLoadError && (
        <DataLoadError
          className="mb-6"
          title="Could not load blogs"
          message="The database query failed. This is not the same as having zero blog posts."
          detail={blogsLoadError}
        />
      )}

      {!blogsLoadError && blogsLoadWarning && (
        <DataLoadError
          className="mb-6 border-amber-200 bg-amber-50 text-amber-900 [&_p]:text-amber-800"
          title="Blogs loaded with a warning"
          message={blogsLoadWarning}
        />
      )}

      {!blogsLoadError && safeBlogs.length === 0 ? (
        <div className="text-center py-14 sm:py-20 bg-white rounded-xl border border-gray-200 border-dashed">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No blogs found</h3>
          <p className="mt-1 text-gray-500 sm:max-w-md mx-auto">
            Get started by creating your first blog post for this website.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {safeBlogs.map((blog) => (
            <div
              key={blog.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group hover:shadow-md transition"
            >
              <div className="h-48 w-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {blog.cover_image_url ? (
                  <img
                    src={blog.cover_image_url}
                    alt={blog.title || 'Blog image'}
                    className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-48 flex items-center justify-center text-gray-400 bg-gray-100">
                    <FileText className="w-10 h-10 opacity-50" />
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-2" title={blog.title || 'Untitled post'}>
                    {blog.title || 'Untitled post'}
                  </h3>
                  <span
                    className={`ml-2 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      blog.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {blog.status === 'draft' ? 'Draft' : 'Published'}
                  </span>
                </div>
                {formatDisplayDate(blog.date_published) && (
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    {formatDisplayDate(blog.date_published)}
                  </p>
                )}
                <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                  {blog.description || 'No description provided.'}
                </p>
                <BlogReactions blogId={blog.id} initialCounts={reactionCountsByBlog?.[blog.id]} interactive={false} />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
                  <a
                    href={site.domain ? `https://${site.domain}/blog/${blog.slug}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2.5 px-3 rounded-lg border border-gray-200 transition text-sm disabled:pointer-events-none disabled:opacity-50"
                    aria-disabled={blog.status === 'draft'}
                    onClick={(event) => {
                      if (blog.status === 'draft' || !site.domain) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <ExternalLink className="w-4 h-4" /> {blog.status === 'draft' ? 'Not Public' : 'View'}
                  </a>
                  <Link
                    href={`/sites/${site.id}/blogs/edit/${blog.id}`}
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium py-2.5 px-3 rounded-lg border border-blue-200 transition text-sm"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete({ id: blog.id, title: blog.title || 'Untitled post' });
                    }}
                    disabled={deletingBlogId === blog.id}
                    className="w-full sm:w-auto flex items-center justify-center p-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title={deletingBlogId === blog.id ? 'Deleting...' : 'Delete blog'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete blog post?</h2>
            <p className="text-sm text-gray-600 mb-6">
              You are about to delete <span className="font-medium text-gray-900">"{pendingDelete.title}"</span>.
              This action cannot be undone.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setPendingDelete(null)}
                disabled={deletingBlogId === pendingDelete.id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleDelete}
                disabled={deletingBlogId === pendingDelete.id}
              >
                {deletingBlogId === pendingDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

