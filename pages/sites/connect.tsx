import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { requireAuthentication, requireSetupPassword } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

interface ConnectSitePageProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const getServerSideProps = requireAuthentication(
  requireSetupPassword(async () => {
    return {
      props: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
    };
  }),
);

export default function ConnectSitePage({ supabaseUrl, supabaseAnonKey }: ConnectSitePageProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    site_key: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');

  const normalizedSiteKey = formData.site_key.trim().toLowerCase();
  const integrationSnippet = `const SITE_KEY = "${normalizedSiteKey || 'your-site-key'}";

const { data: site } = await supabase
  .from('sites')
  .select('id')
  .eq('site_key', SITE_KEY)
  .single();

const { data: blogs } = await supabase
  .from('blogs')
  .select('*')
  .eq('site_id', site.id)
  .order('display_date', { ascending: false });`;

  const helperFunctionsSnippet = `export async function getSiteByKey(supabase, siteKey) {
  const { data: site, error } = await supabase
    .from('sites')
    .select('id, name, site_key')
    .eq('site_key', siteKey)
    .single();

  if (error || !site) throw new Error('Site not found');
  return site;
}

export async function getBlogsBySiteKey(supabase, siteKey) {
  const site = await getSiteByKey(supabase, siteKey);
  const { data: blogs, error } = await supabase
    .from('blogs')
    .select('*')
    .eq('site_id', site.id)
    .order('display_date', { ascending: false });

  if (error) throw error;
  return blogs ?? [];
}`;

  const copyText = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('Copy failed. Please copy manually.');
    }
  };

  const onCreateSite = async () => {
    setError('');
    setSuccess('');

    if (!normalizedSiteKey) {
      setError('site_key is required.');
      return;
    }
    if (!SITE_KEY_REGEX.test(normalizedSiteKey)) {
      setError('site_key must use lowercase letters, numbers, and hyphens only.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim() || null,
          domain: formData.domain.trim(),
          site_key: normalizedSiteKey,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.message || 'Failed to create/connect site');
      }

      setSuccess(`Site connected successfully with site_key "${normalizedSiteKey}".`);
      setFormData({ name: '', domain: '', site_key: '' });
      await router.replace(router.asPath);
    } catch (requestError: any) {
      setError(requestError?.message || 'Failed to create/connect site');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <Head>
        <title>Connect Site - Skyen Blog Admin</title>
      </Head>

      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Add / Connect New Site</h1>
        <p className="text-slate-500 mt-1">
          Register a new tenant with `site_key`, then copy the exact integration instructions for the website project.
        </p>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">1) Required Site Credentials</h2>
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
              placeholder="Domain (optional)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={formData.site_key}
              onChange={(event) => setFormData((prev) => ({ ...prev, site_key: event.target.value.toLowerCase() }))}
              placeholder="site_key (required)"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            `site_key` should stay stable forever (e.g. `studiely`, `skyen-solutions`).
          </p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onCreateSite}
              disabled={isSaving}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'Connecting...' : 'Connect site'}
            </button>
            {success && <p className="text-sm text-green-700">{success}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">2) Add These Env Vars To New Website</h2>
          <pre className="bg-gray-900 text-gray-100 text-xs sm:text-sm rounded-lg p-3 sm:p-4 overflow-x-auto">
            <code>{`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'https://your-project.supabase.co'}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey || 'your-anon-key'}
SITE_KEY=${normalizedSiteKey || 'your-site-key'}`}</code>
          </pre>
          <button
            type="button"
            onClick={() =>
              copyText(
                `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl || 'https://your-project.supabase.co'}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${
                  supabaseAnonKey || 'your-anon-key'
                }\nSITE_KEY=${normalizedSiteKey || 'your-site-key'}`,
                'env',
              )
            }
            className="mt-3 w-full sm:w-auto justify-center text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1.5"
          >
            {copied === 'env' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === 'env' ? 'Copied' : 'Copy env block'}
          </button>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">3) Connection Steps</h2>
          <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
            <li>Create/connect the site above and keep the generated `site_key` fixed.</li>
            <li>Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SITE_KEY` in your website `.env`.</li>
            <li>In website backend/frontend functions, resolve site by `site_key` and fetch blogs by `site_id`.</li>
            <li>Do not rely on domain lookup for site resolution anymore.</li>
          </ol>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">4) Fetch Blogs Using site_key</h2>
            <button
              type="button"
              onClick={() => copyText(integrationSnippet, 'fetch')}
              className="w-full sm:w-auto justify-center text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              {copied === 'fetch' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'fetch' ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 text-xs sm:text-sm rounded-lg p-3 sm:p-4 overflow-x-auto">
            <code>{integrationSnippet}</code>
          </pre>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-gray-900">5) Recommended Helper Functions</h2>
            <button
              type="button"
              onClick={() => copyText(helperFunctionsSnippet, 'helpers')}
              className="w-full sm:w-auto justify-center text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex items-center gap-1.5"
            >
              {copied === 'helpers' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === 'helpers' ? 'Copied' : 'Copy helpers'}
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 text-xs sm:text-sm rounded-lg p-3 sm:p-4 overflow-x-auto">
            <code>{helperFunctionsSnippet}</code>
          </pre>
        </section>
      </div>
    </AdminLayout>
  );
}
