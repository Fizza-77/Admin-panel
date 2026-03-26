import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';

export const getServerSideProps = requireAuthentication(async (_ctx: GetServerSidePropsContext) => {
  // Legacy route: redirect to the configured default site if present.
  const defaultSiteKey = process.env.DEFAULT_SITE_KEY || process.env.NEXT_PUBLIC_DEFAULT_SITE_KEY;

  const siteQuery = supabase.from('sites').select('id').order('created_at', { ascending: true }).limit(1);
  const { data: site, error } = defaultSiteKey
    ? await siteQuery.eq('site_key', defaultSiteKey).maybeSingle()
    : await siteQuery.maybeSingle();

  if (error || !site) {
    return {
      redirect: {
        destination: '/sites',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: `/sites/${site.id}/blogs/create`,
      permanent: false,
    },
  };
});

export default function LegacyCreateBlogRedirect() {
  return null;
}
