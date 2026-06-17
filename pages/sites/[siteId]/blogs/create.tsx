import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { resolveSitePage } from '@/lib/sites/resolveSitePageProps';
import type { Site } from '@/types/site';
import type { AppPermissions } from '@/lib/permissions/types';

interface CreateSiteBlogPageProps {
  site: Site;
  permissions: AppPermissions;
}

export const getServerSideProps = requireAuthentication(
  requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
    const resolved = await resolveSitePage(context);
    if (resolved.kind === 'site') {
      return { props: { site: resolved.site } };
    }
    if (resolved.kind === 'redirect') {
      return { redirect: { destination: resolved.destination, permanent: false } };
    }
    return { notFound: true };
  }),
);

export default function CreateSiteBlog({ site, permissions }: CreateSiteBlogPageProps) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Create Blog - {site.name || site.domain || site.site_key}</title>
      </Head>
      <BlogForm
        isEdit={false}
        siteId={site.id}
        siteName={site.name || site.domain || site.site_key}
      />
    </AdminLayout>
  );
}

