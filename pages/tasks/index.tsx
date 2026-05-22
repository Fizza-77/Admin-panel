import Head from 'next/head';
import { requireAuthentication, requirePermission } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import type { AppPermissions } from '@/lib/permissions/types';
import TaskKanban from '@/components/tasks/TaskKanban';

export const getServerSideProps = requireAuthentication(
  requirePermission({ tasks: true }, async (_ctx, auth) => ({
    props: { currentUserId: auth.userId },
  })),
);

export default function TasksHomePage({
  permissions,
  currentUserId,
}: {
  permissions: AppPermissions;
  currentUserId: string;
}) {
  return (
    <AdminLayout permissions={permissions}>
      <Head>
        <title>Tasks - Skyen Admin</title>
      </Head>
      <TaskKanban permissions={permissions} currentUserId={currentUserId} />
    </AdminLayout>
  );
}
