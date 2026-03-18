import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';

export const getServerSideProps = requireAuthentication(async (_ctx: GetServerSidePropsContext) => {
  // Legacy route: redirect to the Studiely site blogs list for backwards compatibility.
  const { data: site, error } = await supabase
    .from('sites')
    .select('id,domain')
    .eq('domain', 'studiely.app')
    .single();

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
      destination: `/sites/${site.id}/blogs`,
      permanent: false,
    },
  };
});

export default function LegacyBlogsIndexRedirect() {
  return null;
}
