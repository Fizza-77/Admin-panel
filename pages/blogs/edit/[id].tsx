import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const { id } = context.params as { id: string };

  const { data: blog, error } = await supabase
    .from('blogs')
    .select('id,site_id')
    .eq('id', id)
    .single();

  if (error || !blog) {
    return {
      notFound: true,
    };
  }

  return {
    redirect: {
      destination: `/sites/${blog.site_id}/blogs/edit/${blog.id}`,
      permanent: false,
    },
  };
});

export default function LegacyEditBlogRedirect() {
  return null;
}
