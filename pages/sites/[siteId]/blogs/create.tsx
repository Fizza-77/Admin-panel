import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';
import type { BlogCategory } from '@/types/blogCategory';

interface CreateSiteBlogPageProps {
  site: Site;
  categories: BlogCategory[];
}

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
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
    .select('id,slug,name,description,sort_order')
    .order('sort_order', { ascending: true });

  return {
    props: {
      site,
      categories: categories ?? [],
    },
  };
});

export default function CreateSiteBlog({ site, categories }: CreateSiteBlogPageProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Create Blog - {site.name || site.domain || site.site_key}</title>
      </Head>
      <BlogForm isEdit={false} siteId={site.id} categories={categories} />
    </AdminLayout>
  );
}

