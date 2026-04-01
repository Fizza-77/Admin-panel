import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication, requireSetupPassword } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { supabase } from '@/lib/supabase/server';
import { Loader2 } from 'lucide-react';
import type { Site } from '@/types/site';
import type { BlogCategory } from '@/types/blogCategory';

type Blog = {
  id: string;
  site_id: string;
  title: string;
  // other fields are kept as any for now
  [key: string]: any;
};

interface EditSiteBlogPageProps {
  site: Site;
  blog: Blog;
  categories: BlogCategory[];
}

export const getServerSideProps = requireAuthentication(
  requireSetupPassword(async (context: GetServerSidePropsContext) => {
    const { siteId, id } = context.params as { siteId: string; id: string };

    const { data: blog, error: blogError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .eq('site_id', siteId)
      .single();

    if (blogError || !blog) {
      return {
        notFound: true,
      };
    }

    const { data: site, error: siteError } = await supabase
      .from('sites')
      .select('id,name,domain,site_key')
      .eq('id', blog.site_id)
      .single();

    if (siteError || !site) {
      return {
        notFound: true,
      };
    }

    const { data: categories } = await supabase
      .from('blog_categories')
      .select('id,slug,name,description,sort_order')
      .order('sort_order', { ascending: true });

    return {
      props: {
        site,
        blog,
        categories: categories ?? [],
      },
    };
  }),
);

export default function EditSiteBlog({ site, blog, categories }: EditSiteBlogPageProps) {
  if (!blog) {
    return (
      <AdminLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <Head>
        <title>Edit {blog.title} - {site.name || site.domain || site.site_key}</title>
      </Head>
      <BlogForm initialData={blog} isEdit={true} siteId={site.id} categories={categories} />
    </AdminLayout>
  );
}

