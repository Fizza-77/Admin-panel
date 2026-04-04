import Head from 'next/head';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { requireAuthentication, requireSetupPassword, setupUnlockHref } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';
import type { BlogCategory } from '@/types/blogCategory';
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react';

interface PageProps {
  site: Site;
  categories: BlogCategory[];
}

export const getServerSideProps = requireAuthentication(
  requireSetupPassword(async (context: GetServerSidePropsContext) => {
    const { siteId } = context.params as { siteId: string };

    const { data: site, error } = await supabase
      .from('sites')
      .select('id,name,domain,site_key')
      .eq('id', siteId)
      .single();

    if (error || !site) {
      return { notFound: true };
    }

    const { data: categories } = await supabase
      .from('blog_categories')
      .select('id,site_id,slug,name,description,sort_order')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true });

    return {
      props: {
        site,
        categories: categories ?? [],
      },
    };
  }),
);

const SLUG_HINT = /^[a-z0-9-]+$/;

export default function SiteCategoriesPage({ site, categories: initialCategories }: PageProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = async () => {
    const res = await fetch(`/api/sites/${site.id}/blog-categories`, { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.categories) {
      setCategories(body.categories);
    }
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalized = slug.trim().toLowerCase();
    if (!normalized || !SLUG_HINT.test(normalized)) {
      setError('Slug: lowercase letters, numbers, and hyphens only.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/sites/${site.id}/blog-categories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: normalized,
          name: name.trim(),
          description: description.trim() || null,
          sort_order: sortOrder,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || 'Failed to add category');
      }
      setSlug('');
      setName('');
      setDescription('');
      setSortOrder(0);
      await reload();
      await router.replace(router.asPath);
    } catch (err: any) {
      setError(err.message || 'Failed to add category');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this category? Posts using it will have category cleared.')) return;
    setDeletingId(id);
    setError('');
    try {
      const res = await fetch(`/api/sites/${site.id}/blog-categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.message || 'Failed to delete');
      }
      await reload();
      await router.replace(router.asPath);
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Blog categories - {site.name || site.site_key} | Admin</title>
      </Head>

      <div className="mb-6">
        <Link
          href={`/sites/${site.id}/setup`}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to setup
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Blog categories</h1>
        <p className="text-slate-600 text-sm mt-1">
          Categories are specific to <span className="font-mono">{site.site_key}</span>. They appear in the post editor
          and on your public site when filtered by this site.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Existing categories</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-slate-500">No categories yet. Add one on the right.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {categories.map((c) => (
                <li key={c.id} className="py-3 flex justify-between gap-3 sm:gap-4 items-start">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">{c.name}</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 break-all">{c.slug}</p>
                    {c.description && <p className="text-sm text-slate-600 mt-1">{c.description}</p>}
                    <p className="text-xs text-slate-400 mt-1">Sort: {c.sort_order}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    disabled={deletingId === c.id}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === c.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add category
          </h2>
          <form onSubmit={onAdd} className="space-y-4">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Slug</label>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="e.g. lesson-planning"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Lesson Planning"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sort order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg text-sm disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Add category
            </button>
          </form>
        </div>
      </div>

      <p className="text-xs text-slate-500 mt-6 sm:mt-8">
        Quick links:{' '}
        <Link href={setupUnlockHref(`/sites/${site.id}/blogs/create`)} className="text-cyan-700 hover:underline">
          New blog post
        </Link>
      </p>
    </AdminLayout>
  );
}
