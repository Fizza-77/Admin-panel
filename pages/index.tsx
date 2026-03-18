import Head from 'next/head';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { supabase } from '@/lib/supabase/server';

export const getServerSideProps = requireAuthentication(async () => {
  const { data: sites, error } = await supabase.from('sites').select('id,name,domain').order('created_at', {
    ascending: true,
  });

  if (error) {
    console.error('Error loading sites for dashboard:', error);
  }

  return {
    props: {
      sites: sites ?? [],
    },
  };
});

interface DashboardProps {
  sites: { id: string; name: string | null; domain: string }[];
}

export default function Dashboard({ sites }: DashboardProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Dashboard - Admin</title>
      </Head>

      <SitesList sites={sites} />
    </AdminLayout>
  );
}

