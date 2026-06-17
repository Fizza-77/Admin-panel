import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import { checkAppProfileSchema } from '@/lib/db/schemaCheck';
import { listOrphanedBlogSites } from '@/lib/sites/orphanedBlogSites';
import { formatDbError, isRlsPolicyError } from '@/lib/db/errors';
import { inspectServiceRoleKey } from '@/lib/supabase/validateServiceRoleKey';

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
    service_role_key: {
      valid: boolean;
      role: string | null;
      matches_anon_key: boolean;
      message: string | null;
    };
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
  app_profiles_write_probe: {
    ok: boolean;
    error: string | null;
  };
  orphaned_blog_sites: {
    count: number;
    blog_rows_affected: number;
    sample_site_ids: string[];
  };
};

async function countTable(table: 'sites' | 'blogs' | 'app_profiles'): Promise<TableCheck> {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    return { ok: false, count: null, error: formatDbError(error) };
  }
  return { ok: true, count: count ?? 0, error: null };
}

/** Detect RLS / wrong-key issues: service role must read app_profiles when rows exist. */
async function probeAppProfilesAccess(): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await supabase.from('app_profiles').select('user_id').limit(1);
  if (error) {
    const msg = isRlsPolicyError(error)
      ? `${formatDbError(error)} — likely SUPABASE_SERVICE_ROLE_KEY is the anon key on this server`
      : formatDbError(error);
    return { ok: false, error: msg };
  }
  return { ok: true, error: null };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<HealthResponse>) {
  const emptyKeyStatus = {
    valid: false,
    role: null,
    matches_anon_key: false,
    message: null as string | null,
  };

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      supabase: { configured: false, reachable: false, error: 'Method Not Allowed', service_role_key: emptyKeyStatus },
      tables: {
        sites: { ok: false, count: null, error: null },
        blogs: { ok: false, count: null, error: null },
        app_profiles: { ok: false, count: null, error: null },
      },
      app_profiles_schema: { tableReadable: false, missingColumns: [], error: null },
      app_profiles_write_probe: { ok: false, error: null },
      orphaned_blog_sites: { count: 0, blog_rows_affected: 0, sample_site_ids: [] },
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const configured = Boolean(supabaseUrl && serviceKey);

  const keyStatus = serviceKey
    ? inspectServiceRoleKey(serviceKey, anonKey)
    : { valid: false, role: null, matchesAnonKey: false, message: 'SUPABASE_SERVICE_ROLE_KEY is missing' };

  const serviceRoleKeyResponse = {
    valid: keyStatus.valid,
    role: keyStatus.role,
    matches_anon_key: keyStatus.matchesAnonKey,
    message: keyStatus.message,
  };

  if (!configured) {
    return res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      supabase: {
        configured: false,
        reachable: false,
        error: 'Missing Supabase environment variables',
        service_role_key: serviceRoleKeyResponse,
      },
      tables: {
        sites: { ok: false, count: null, error: 'Not checked' },
        blogs: { ok: false, count: null, error: 'Not checked' },
        app_profiles: { ok: false, count: null, error: 'Not checked' },
      },
      app_profiles_schema: { tableReadable: false, missingColumns: [], error: 'Not checked' },
      app_profiles_write_probe: { ok: false, error: 'Not checked' },
      orphaned_blog_sites: { count: 0, blog_rows_affected: 0, sample_site_ids: [] },
    });
  }

  const [sites, blogs, appProfiles, schema, profileProbe, orphanedSites] = await Promise.all([
    countTable('sites'),
    countTable('blogs'),
    countTable('app_profiles'),
    checkAppProfileSchema(),
    probeAppProfilesAccess(),
    listOrphanedBlogSites(),
  ]);

  const orphanedBlogSites = {
    count: orphanedSites.orphans.length,
    blog_rows_affected: orphanedSites.orphans.reduce((sum, item) => sum + item.blog_count, 0),
    sample_site_ids: orphanedSites.orphans.slice(0, 5).map((item) => item.site_id),
  };

  const reachable = sites.ok || blogs.ok || appProfiles.ok;
  const tableFailures = [sites, blogs, appProfiles].filter((t) => !t.ok).length;
  const schemaIssues = schema.missingColumns.length > 0 || Boolean(schema.queryError);
  const keyInvalid = !keyStatus.valid || !supabaseServiceRoleKeyStatus.valid;

  let status: HealthResponse['status'] = 'ok';
  if (!reachable || keyInvalid || !profileProbe.ok) {
    status = 'error';
  } else if (tableFailures > 0 || schemaIssues || orphanedBlogSites.count > 0) {
    status = 'degraded';
  }

  const httpStatus = status === 'error' ? 503 : 200;

  return res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    supabase: {
      configured: true,
      reachable,
      error: keyInvalid
        ? keyStatus.message
        : reachable
          ? null
          : sites.error ?? blogs.error ?? appProfiles.error,
      service_role_key: serviceRoleKeyResponse,
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
    app_profiles_write_probe: profileProbe,
    orphaned_blog_sites: orphanedBlogSites,
  });
}
