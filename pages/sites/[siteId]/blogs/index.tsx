import Head from 'next/head';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { requireAuthentication } from '@/lib/auth';
import { setupUnlockHref } from '@/lib/setup';
import AdminLayout from '@/components/Layout/AdminLayout';
import { supabase } from '@/lib/supabase/server';
import { PlusCircle, Search, Edit2, Trash2, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import type { Site } from '@/types/site';

type Blog = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  cover_image_url: string | null;
  display_date: string | null;
};

interface SiteBlogsPageProps {
  site: Site;
  blogs: Blog[];
}

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const { siteId } = context.params as { siteId: string };

  const { data: site, error: siteError } = await supabase
    .from('sites')
    .select('id,name,domain,site_key')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return { notFound: true };
  }

  const { data: blogs, error: blogsError } = await supabase
    .from('blogs')
    .select('id,title,description,slug,cover_image_url,display_date,created_at')
    .eq('site_id', site.id)
    .order('created_at', { ascending: false });

  if (blogsError) {
    console.error('Error fetching blogs:', blogsError);
  }

  return {
    props: {
      site,
      blogs: blogs ?? [],
    },
  };
});

export default function SiteBlogsPage({ site, blogs }: SiteBlogsPageProps) {
  const router = useRouter();
  const [deletingBlogId, setDeletingBlogId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);

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
      setDeleteError(error?.message || 'Failed to delete blog');
    } finally {
      setDeletingBlogId(null);
    }
  };

  return (
    <AdminLayout>
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

      {blogs.length === 0 ? (
        <div className="text-center py-14 sm:py-20 bg-white rounded-xl border border-gray-200 border-dashed">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No blogs found</h3>
          <p className="mt-1 text-gray-500 sm:max-w-md mx-auto">
            Get started by creating your first blog post for this website.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {blogs.map((blog) => (
            <div
              key={blog.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col group hover:shadow-md transition"
            >
              <div className="h-48 w-full bg-gray-100 flex items-center justify-center overflow-hidden relative">
                {blog.cover_image_url ? (
                  <img
                    src={blog.cover_image_url}
                    alt={blog.title}
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
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-2" title={blog.title}>
                    {blog.title}
                  </h3>
                </div>
                {blog.display_date && (
                  <p className="text-xs text-gray-500 font-medium mb-3">
                    {format(new Date(blog.display_date), 'MMM d, yyyy')}
                  </p>
                )}
                <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                  {blog.description || 'No description provided.'}
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
                  <a
                    href={`https://${site.domain}/blog/${blog.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 min-w-0 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2.5 px-3 rounded-lg border border-gray-200 transition text-sm"
                  >
                    <ExternalLink className="w-4 h-4" /> View
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
                      setPendingDelete({ id: blog.id, title: blog.title });
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

