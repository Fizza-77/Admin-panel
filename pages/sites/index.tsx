import Head from 'next/head';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { listSites } from '@/lib/sites';
import type { Site } from '@/types/site';
import type { AppPermissions } from '@/lib/permissions/types';

interface SitesPageProps {
  sites: Site[];
  hasSitesLoadError: boolean;
  permissions: AppPermissions;
}

export const getServerSideProps = requireAuthentication(
  requirePermission({ blogs: true }, async () => {
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
  }),
);

export default function SitesPage({ sites, hasSitesLoadError, permissions }: SitesPageProps) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Sites - Admin</title>
      </Head>

      <SitesList sites={sites} hasLoadError={hasSitesLoadError} />
    </AdminLayout>
  );
}

