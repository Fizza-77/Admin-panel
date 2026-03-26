import Head from 'next/head';
import { requireAuthentication } from '@/lib/auth';
import AdminLayout from '@/components/Layout/AdminLayout';
import SitesList from '@/components/SitesList';
import { supabase } from '@/lib/supabase/server';
import type { Site } from '@/types/site';

interface SitesPageProps {
  sites: Site[];
}

export const getServerSideProps = requireAuthentication(async () => {
  const { data: sites, error } = await supabase.from('sites').select('id,name,domain,site_key').order('created_at', {
    ascending: true,
  });

  if (error) {
    console.error('Error loading sites:', error);
  }

  return {
    props: {
      sites: sites ?? [],
    },
  };
});

export default function SitesPage({ sites }: SitesPageProps) {
  return (
    <AdminLayout>
      <Head>
        <title>Sites - Admin</title>
      </Head>

      <SitesList sites={sites} />
    </AdminLayout>
  );
}

