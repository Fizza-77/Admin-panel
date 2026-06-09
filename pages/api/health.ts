import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/lib/supabase/server';
import { checkAppProfileSchema } from '@/lib/db/schemaCheck';
import { formatDbError } from '@/lib/db/errors';

type TableCheck = {
  ok: boolean;
  count: number | null;
  error: string | null;
};

type HealthResponse = {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  supabase: {
    configured: boolean;
    reachable: boolean;
    error: string | null;
  };
  tables: {
    sites: TableCheck;
    blogs: TableCheck;
    app_profiles: TableCheck;
  };
  app_profiles_schema: {
    tableReadable: boolean;
    missingColumns: string[];
    error: string | null;
  };
};

async function countTable(table: 'sites' | 'blogs' | 'app_profiles'): Promise<TableCheck> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    return { ok: false, count: null, error: formatDbError(error) };
  }
  return { ok: true, count: count ?? 0, error: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      supabase: { configured: false, reachable: false, error: 'Method Not Allowed' },
      tables: {
        sites: { ok: false, count: null, error: null },
        blogs: { ok: false, count: null, error: null },
        app_profiles: { ok: false, count: null, error: null },
      },
      app_profiles_schema: { tableReadable: false, missingColumns: [], error: null },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configured = Boolean(supabaseUrl && serviceKey);

  if (!configured) {
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      supabase: { configured: false, reachable: false, error: 'Missing Supabase environment variables' },
      tables: {
        sites: { ok: false, count: null, error: 'Not checked' },
        blogs: { ok: false, count: null, error: 'Not checked' },
        app_profiles: { ok: false, count: null, error: 'Not checked' },
      },
      app_profiles_schema: { tableReadable: false, missingColumns: [], error: 'Not checked' },
    });
  }

  const [sites, blogs, appProfiles, schema] = await Promise.all([
    countTable('sites'),
    countTable('blogs'),
    countTable('app_profiles'),
    checkAppProfileSchema(),
  ]);

  const reachable = sites.ok || blogs.ok || appProfiles.ok;
  const tableFailures = [sites, blogs, appProfiles].filter((t) => !t.ok).length;
  const schemaIssues = schema.missingColumns.length > 0 || Boolean(schema.queryError);

  let status: HealthResponse['status'] = 'ok';
  if (!reachable) {
    status = 'error';
  } else if (tableFailures > 0 || schemaIssues) {
    status = 'degraded';
  }

  const httpStatus = status === 'error' ? 503 : 200;

  return res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    supabase: {
      configured: true,
      reachable,
      error: reachable ? null : sites.error ?? blogs.error ?? appProfiles.error,
    },
    tables: {
      sites,
      blogs,
      app_profiles: appProfiles,
    },
    app_profiles_schema: {
      tableReadable: schema.tableReadable,
      missingColumns: schema.missingColumns,
      error: schema.queryError,
    },
  });
}
