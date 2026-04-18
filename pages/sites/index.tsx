import Head from 'next/head';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { listSites } from '@/lib/sites';
import type { Site } from '@/types/site';

interface SitesPageProps {
  sites: Site[];
  hasSitesLoadError: boolean;
}

export const getServerSideProps = requireAuthentication(async () => {
  const { sites, error } = await listSites();

  if (error) {
    console.error('Error loading sites:', error);
  }

  return {
    props: {
      sites,
      hasSitesLoadError: Boolean(error),
    },
  };
});

export default function SitesPage({ sites, hasSitesLoadError }: SitesPageProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Sites - Admin</title>
      </Head>

      <SitesList sites={sites} hasLoadError={hasSitesLoadError} />
    </AdminLayout>
  );
}

