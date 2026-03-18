import Head from 'next/head';
import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import BlogForm from '@/components/BlogForm';
import { supabase } from '@/lib/supabase/server';
import { Loader2 } from 'lucide-react';

type Site = {
  id: string;
  name: string | null;
  domain: string;
};

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
}

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
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
    .select('id,name,domain')
    .eq('id', blog.site_id)
    .single();

  if (siteError || !site) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      site,
      blog,
    },
  };
});

export default function EditSiteBlog({ site, blog }: EditSiteBlogPageProps) {
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
        <title>Edit {blog.title} - {site.name || site.domain}</title>
      </Head>
      <BlogForm initialData={blog} isEdit={true} siteId={site.id} />
    </AdminLayout>
  );
}

