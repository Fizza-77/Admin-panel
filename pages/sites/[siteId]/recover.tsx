import Head from 'next/head';
import { useState } from 'react';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { requireAuthentication, requirePermission, requireSetupPassword } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import { countBlogsForSiteId, lookupSiteById, normalizeSiteId } from '@/lib/sites/getSiteById';
import type { AppPermissions } from '@/lib/permissions/types';
import { reportError } from '@/lib/monitoring';

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

type RecoverSitePageProps = {
  siteId: string;
  blogCount: number;
  permissions: AppPermissions;
};

export const getServerSideProps = requireAuthentication(
  requireSetupPassword(
    requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
      const rawId = context.params?.siteId;
      const siteId = normalizeSiteId(typeof rawId === 'string' ? rawId : null);
      if (!siteId) {
        return { notFound: true };
      }

      const existing = await lookupSiteById(siteId);
      if (existing.ok) {
        return {
          redirect: {
            destination: `/sites/${siteId}/blogs`,
            permanent: false,
          },
        };
      }

      const blogCount = await countBlogsForSiteId(siteId);
      if (blogCount === 0) {
        return { notFound: true };
      }

      return {
        props: {
          siteId,
          blogCount,
        },
      };
    }),
  ),
);

export default function RecoverSitePage({ siteId, blogCount, permissions }: RecoverSitePageProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [siteKey, setSiteKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedKey = siteKey.trim().toLowerCase();
    if (!normalizedKey) {
      setError('site_key is required.');
      return;
    }
    if (!SITE_KEY_REGEX.test(normalizedKey)) {
      setError('site_key must use lowercase letters, numbers, and hyphens only.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/sites/recover', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          name: name.trim() || null,
          domain: domain.trim(),
          site_key: normalizedKey,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || 'Could not re-connect site');
      }
      await router.push(`/sites/${siteId}/blogs`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not re-connect site';
      setError(msg);
      reportError(err, { source: 'RecoverSitePage.onSubmit', siteId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Re-connect site - Skyen Admin</title>
      </Head>
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Re-connect orphaned site</h1>
          <p className="mt-2 text-sm text-slate-600">
            This site id has <span className="font-semibold">{blogCount}</span> blog post
            {blogCount === 1 ? '' : 's'} in the database, but the site record itself is missing from{' '}
            <code className="rounded bg-slate-100 px-1 text-xs">sites</code>. That is why new blog creation fails with
            &quot;Site not found&quot;.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-500 break-all">{siteId}</p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Site name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Studiely"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Domain</span>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. studiely.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">site_key (required, permanent)</span>
            <input
              type="text"
              required
              value={siteKey}
              onChange={(e) => setSiteKey(e.target.value.toLowerCase())}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              placeholder="e.g. studiely"
            />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Re-connect site'}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
