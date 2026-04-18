import Head from 'next/head';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { listSites } from '@/lib/sites';
import type { Site } from '@/types/site';

export const getServerSideProps = requireAuthentication(async () => {
  const { sites, error } = await listSites();

  if (error) {
    console.error('Error loading sites for dashboard:', error);
  }

  return {
    props: {
      sites,
      hasSitesLoadError: Boolean(error),
    },
  };
});

interface DashboardProps {
  sites: Site[];
  hasSitesLoadError: boolean;
}

export default function Dashboard({ sites, hasSitesLoadError }: DashboardProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Dashboard - Admin</title>
      </Head>

      <SitesList sites={sites} hasLoadError={hasSitesLoadError} />
    </AdminLayout>
  );
}

