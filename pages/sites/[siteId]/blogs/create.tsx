import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';
import type { AppPermissions } from '@/lib/permissions/types';

interface CreateSiteBlogPageProps {
  site: Site;
  permissions: AppPermissions;
}

export const getServerSideProps = requireAuthentication(
  requirePermission({ blogs: true }, async (context: GetServerSidePropsContext) => {
  const { siteId } = context.params as { siteId: string };

  const { data: site, error } = await supabase
    .from('sites')
    .select('id,name,domain,site_key')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return { notFound: true };
  }

  return {
    props: {
      site,
    },
  };
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

