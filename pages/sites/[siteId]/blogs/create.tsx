import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { supabase } from '@/lib/supabase/server';

type Site = {
  id: string;
  name: string | null;
  domain: string;
};

interface CreateSiteBlogPageProps {
  site: Site;
}

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const { siteId } = context.params as { siteId: string };

  const { data: site, error } = await supabase
    .from('sites')
    .select('id,name,domain')
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
});

export default function CreateSiteBlog({ site }: CreateSiteBlogPageProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Create Blog - {site.name || site.domain}</title>
      </Head>
      <BlogForm isEdit={false} siteId={site.id} />
    </AdminLayout>
  );
}

