import Head from 'next/head';
import Link from 'next/link';
import Router from 'next/router';
import { GetServerSidePropsContext } from 'next';
import { useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { LoadingOverlay } from '@/components/ui/Spinner';
import OutlineFillButton, { OutlineFillButtonAction, PlusIcon, BlogsListIcon } from '@/components/ui/OutlineFillButton';
import { requireAuthentication, requirePermission, requireSetupPassword } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';
import { reportError } from '@/lib/monitoring';

import type { AppPermissions } from '@/lib/permissions/types';

interface SiteSetupPageProps {
  site: Site;
  supabaseUrl: string;
  supabaseAnonKey: string;
  permissions: AppPermissions;
}

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

export const getServerSideProps = requireAuthentication(
  requireSetupPassword(
    requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
    const { siteId } = context.params as { siteId: string };

    const { data: site, error } = await supabase.from('sites').select('*').eq('id', siteId).single();

    if (error || !site) {
      return { notFound: true };
    }

    return {
      props: {
        site,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    };
    }),
  ),
);

export default function SiteSetupPage({ site, supabaseUrl, supabaseAnonKey, permissions }: SiteSetupPageProps) {
  const [formData, setFormData] = useState({
    name: site.name || '',
    domain: site.domain || '',
    site_key: site.site_key || '',
    blog_page_meta_title: site.blog_page_meta_title || '',
    blog_page_meta_description: site.blog_page_meta_description || '',
    blog_page_headline: site.blog_page_headline || '',
    blog_page_subheadline: site.blog_page_subheadline || '',
    blog_empty_state_message: site.blog_empty_state_message || '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [copied, setCopied] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const integrationSnippet = `const SITE_KEY = "${formData.site_key || site.site_key}";

const { data: site } = await supabase
  .from('sites')
  .select('id')
  .eq('site_key', SITE_KEY)
  .single();

const { data: blogs } = await supabase
  .from('blogs')
  .select('*')
  .eq('site_id', site.id)
  .eq('status', 'published');`;

  const copyText = async (value: string, key: string) => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable in this browser context');
      }
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch (error) {
      reportError(error, { source: 'SiteSetupPage.copyText', key, siteId: site?.id ?? null });
      setSaveError('Copy failed. Please copy manually.');
    }
  };

  const onSave = async () => {
    setSaveError('');
    setSaveMessage('');
    const normalizedSiteKey = formData.site_key.trim().toLowerCase();

    if (!normalizedSiteKey) {
      setSaveError('Site key is required.');
      return;
    }
    if (!SITE_KEY_REGEX.test(normalizedSiteKey)) {
      setSaveError('Site key can only include lowercase letters, numbers, and hyphens.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim() || null,
          domain: formData.domain.trim(),
          site_key: normalizedSiteKey,
          blog_page_meta_title: formData.blog_page_meta_title,
          blog_page_meta_description: formData.blog_page_meta_description,
          blog_page_headline: formData.blog_page_headline,
          blog_page_subheadline: formData.blog_page_subheadline,
          blog_empty_state_message: formData.blog_empty_state_message,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Failed to update site');
      }

      setFormData((prev) => ({ ...prev, site_key: normalizedSiteKey }));
      setSaveMessage('Site updated successfully.');
    } catch (requestError: any) {
      reportError(requestError, { source: 'SiteSetupPage.onSave', siteId: site?.id ?? null });
      setSaveError(requestError?.message || 'Failed to update site');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/sites/${site.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Failed to delete site');
      }

      // Redirect to sites list after successful deletion
      Router.push('/sites');
    } catch (requestError: any) {
      reportError(requestError, { source: 'SiteSetupPage.onDelete', siteId: site?.id ?? null });
      alert(requestError?.message || 'Failed to delete site');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AdminLayout permissions={permissions}>
      {saving && <LoadingOverlay label="Saving site…" />}
      {deleting && <LoadingOverlay label="Deleting site…" />}
      <Head>
        <title>Setup - {site.name || site.site_key} | Skyen Blog Admin</title>
      </Head>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Site Setup & Integration</h1>
          <p className="text-slate-500 mt-1">Configure this tenant and copy the integration details.</p>
        </div>
        <div className="grid w-full sm:w-auto grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <OutlineFillButton
            href={`/sites/${site.id}/blogs`}
            icon={<BlogsListIcon />}
            className="ui-outline-fill-btn--auto"
          >
            Blogs
          </OutlineFillButton>
          <OutlineFillButton
            href={`/sites/${site.id}/categories`}
            className="ui-outline-fill-btn--auto"
          >
            Categories
          </OutlineFillButton>
          <OutlineFillButton
            href={`/sites/${site.id}/blogs/create`}
            icon={<PlusIcon />}
            className="ui-outline-fill-btn--auto"
          >
            New Blog
          </OutlineFillButton>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">A. Site Info</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Site name"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={formData.domain}
              onChange={(event) => setFormData((prev) => ({ ...prev, domain: event.target.value }))}
              placeholder="example.com"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={formData.site_key}
              onChange={(event) => setFormData((prev) => ({ ...prev, site_key: event.target.value.toLowerCase() }))}
              placeholder="site_key"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">`site_key` must be unique and uses lowercase letters, numbers, and hyphens.</p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <OutlineFillButtonAction
              type="button"
              onClick={onSave}
              disabled={saving}
              className="!w-full sm:!w-auto"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </OutlineFillButtonAction>
            {saveMessage && <span className="text-sm text-green-700">{saveMessage}</span>}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">B. Public blog index page</h2>
          <p className="text-sm text-gray-500 mb-4">
            Used on your website for the blog listing route: title tag, meta description, hero copy, and the empty state
            when there are no posts yet.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Page title (title tag)</label>
              <input
                type="text"
                value={formData.blog_page_meta_title}
                onChange={(e) => setFormData((prev) => ({ ...prev, blog_page_meta_title: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="The Make My Lesson Blog — …"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Meta description</label>
              <textarea
                value={formData.blog_page_meta_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, blog_page_meta_description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Headline</label>
              <input
                type="text"
                value={formData.blog_page_headline}
                onChange={(e) => setFormData((prev) => ({ ...prev, blog_page_headline: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sub-headline</label>
              <textarea
                value={formData.blog_page_subheadline}
                onChange={(e) => setFormData((prev) => ({ ...prev, blog_page_subheadline: e.target.value }))}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Empty state (no posts yet)</label>
              <textarea
                value={formData.blog_empty_state_message}
                onChange={(e) => setFormData((prev) => ({ ...prev, blog_empty_state_message: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Save with section A (Site info) to persist these fields. Manage categories per website from the{' '}
            <Link href={`/sites/${site.id}/categories`} className="text-cyan-700 hover:underline">
              Categories
            </Link>{' '}
            page (or seed via SQL per <code className="font-mono bg-gray-100 px-1 rounded">site_id</code>).
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">C. Environment Variables</h2>
          <div className="space-y-3">
            {[
              { label: 'NEXT_PUBLIC_SUPABASE_URL', value: supabaseUrl },
              { label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: supabaseAnonKey },
              { label: 'SITE_KEY', value: formData.site_key || site.site_key },
            ].map((item) => (
              <div key={item.label} className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-mono text-xs text-gray-800 truncate">{item.value || 'Not configured'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(item.value || '', item.label)}
                  className="w-full sm:w-auto justify-center text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1.5"
                >
                  {copied === item.label ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied === item.label ? 'Copied' : 'Copy'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Add these values to your website `.env.local` (local) and deployment environment variables (production).
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">D. Integration Steps</h2>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
            <li>Add environment variables to your website deployment and local `.env` file.</li>
            <li>Create a Supabase client using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.</li>
            <li>Use this site&apos;s `site_key` to resolve `site_id`, then fetch blogs by `site_id`.</li>
          </ol>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">E. Copy-Paste Snippet</h2>
            <button
              type="button"
              onClick={() => copyText(integrationSnippet, 'snippet')}
              className="w-full sm:w-auto justify-center text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              {copied === 'snippet' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'snippet' ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 text-xs sm:text-sm rounded-lg p-3 sm:p-4 overflow-x-auto">
            <code>{integrationSnippet}</code>
          </pre>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">F. Local Development Note</h2>
          <p className="text-sm text-amber-800">
            For localhost development, hardcode `site_key` in your frontend config. If Supabase RLS blocks the
            `sites` lookup, set `SITE_ID` or `NEXT_PUBLIC_SITE_ID` locally to skip the tenant lookup entirely.
            Domain-based lookup is no longer required in the admin flow.
          </p>
        </section>

        <section className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">G. Delete Site</h2>
          <p className="text-sm text-red-800 mb-4">
            This action will permanently delete this site and all associated blog posts. This cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition text-sm disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete Site'}
          </button>
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-red-900 mb-2">Delete Site?</h2>
            <p className="text-sm text-gray-700 mb-4">
              This will permanently delete <strong>{site.name || site.site_key}</strong> and all {site.id && 'associated'} blog posts.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
