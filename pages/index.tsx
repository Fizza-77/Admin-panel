import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { requireAuthentication } from '@/lib/auth';
import { resolveAdminUserContextFromGssp } from '@/lib/auth/resolveUserContext';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import OrphanedSitesBanner from '@/components/OrphanedSitesBanner';
import { listSites } from '@/lib/sites';
import { listOrphanedBlogSites, type OrphanedBlogSite } from '@/lib/sites/orphanedBlogSites';
import type { Site } from '@/types/site';
import type { AppPermissions } from '@/lib/permissions/types';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const ctx = await resolveAdminUserContextFromGssp(context);
  if (!ctx) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const { permissions, profileLoadError } = ctx;

  if (profileLoadError && !permissions.isPrimaryAdmin) {
    return {
      redirect: {
        destination: `/profile-error?message=${encodeURIComponent(profileLoadError)}`,
        permanent: false,
      },
    };
  }

  if (!permissions.canManageBlogs && permissions.canManageTasks) {
    return { redirect: { destination: '/tasks', permanent: false } };
  }
  if (!permissions.canManageBlogs && !permissions.canManageTasks) {
    if (permissions.canAccessUserManagement) {
      return { redirect: { destination: '/admin/users', permanent: false } };
    }
    if (permissions.canManageAttendance) {
      return { redirect: { destination: '/attendance', permanent: false } };
    }
    return { redirect: { destination: '/unauthorized', permanent: false } };
  }

  const [{ sites, error, warning }, orphanedResult] = await Promise.all([listSites(), listOrphanedBlogSites()]);

  return {
    props: {
      sites,
      hasSitesLoadError: Boolean(error),
      sitesLoadError: error,
      sitesLoadWarning: warning,
      orphanedSites: orphanedResult.orphans,
      orphanedSitesError: orphanedResult.error,
      permissions,
    },
  };
});

interface DashboardProps {
  sites: Site[];
  hasSitesLoadError: boolean;
  sitesLoadError: string | null;
  sitesLoadWarning: string | null;
  orphanedSites: OrphanedBlogSite[];
  orphanedSitesError: string | null;
  permissions: AppPermissions;
}

export default function Dashboard({
  sites,
  hasSitesLoadError,
  sitesLoadError,
  sitesLoadWarning,
  orphanedSites,
  orphanedSitesError,
  permissions,
}: DashboardProps) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Dashboard - Admin</title>
      </Head>

      <OrphanedSitesBanner orphans={orphanedSites} />
      {orphanedSitesError && (
        <p className="mb-6 text-sm text-amber-800">Could not check for orphaned blog sites: {orphanedSitesError}</p>
      )}

      <SitesList
        sites={sites}
        hasLoadError={hasSitesLoadError}
        loadErrorMessage={sitesLoadError}
        loadWarningMessage={sitesLoadWarning}
      />
    </AdminLayout>
  );
}

