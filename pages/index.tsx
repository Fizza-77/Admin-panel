import Head from 'next/head';
import type { GetServerSidePropsContext } from 'next';
import { getAuthUserFromGsspContext, requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { getAppProfile } from '@/lib/permissions/getAppProfile';
import { listSites } from '@/lib/sites';
import type { Site } from '@/types/site';
import type { AppPermissions } from '@/lib/permissions/types';

export const getServerSideProps = requireAuthentication(async (context: GetServerSidePropsContext) => {
  const user = await getAuthUserFromGsspContext(context);
  if (!user) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const permissions = await getAppProfile(user.id, user.email);
  if (!permissions.canManageBlogs && permissions.canManageTasks) {
    return { redirect: { destination: '/tasks', permanent: false } };
  }
  if (!permissions.canManageBlogs && !permissions.canManageTasks) {
    if (permissions.canAccessUserManagement) {
      return { redirect: { destination: '/admin/users', permanent: false } };
    }
    return { redirect: { destination: '/unauthorized', permanent: false } };
  }

  const { sites, error } = await listSites();

  if (error) {
    console.error('Error loading sites for dashboard:', error);
  }

  return {
    props: {
      sites,
      hasSitesLoadError: Boolean(error),
      permissions,
    },
  };
});

interface DashboardProps {
  sites: Site[];
  hasSitesLoadError: boolean;
  permissions: AppPermissions;
}

export default function Dashboard({ sites, hasSitesLoadError, permissions }: DashboardProps) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Dashboard - Admin</title>
      </Head>

      <SitesList sites={sites} hasLoadError={hasSitesLoadError} />
    </AdminLayout>
  );
}

