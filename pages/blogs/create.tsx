import { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { findDefaultSite } from '@/lib/sites';

export const getServerSideProps = requireAuthentication(async (_ctx: GetServerSidePropsContext) => {
  // Legacy route: redirect to the configured default site if present.
  const defaultSiteKey = process.env.DEFAULT_SITE_KEY || process.env.NEXT_PUBLIC_DEFAULT_SITE_KEY;

  const { siteId, error } = await findDefaultSite(defaultSiteKey);

  if (error || !siteId) {
    return {
      redirect: {
        destination: '/sites',
        permanent: false,
      },
    };
  }

  return {
    redirect: {
      destination: `/sites/${siteId}/blogs/create`,
      permanent: false,
    },
  };
});

export default function LegacyCreateBlogRedirect() {
  return null;
}
