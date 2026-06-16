import type { PostgrestError } from '@supabase/supabase-js';
import { supabase, supabaseServiceRoleKeyStatus } from '@/lib/supabase/server';
import {
  formatDbError,
  isMissingColumnError,
  isRlsPolicyError,
  rlsConfigurationHint,
  type DataLoadState,
  dataLoadFailure,
  dataLoadSuccess,
} from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export type BlogListItem = {
  id: string;
  title: string;
  status: 'draft' | 'published';
  description: string | null;
  slug: string;
  cover_image_url: string | null;
  date_published: string | null;
  date_modified: string | null;
  main_entity_of_page: string | null;
};

const FULL_SELECT =
  'id,title,status,description,slug,cover_image_url,date_published,date_modified,main_entity_of_page,faq_schema,created_at';

const LEGACY_SELECT =
  'id,title,status,description,slug,cover_image_url,display_date,created_at';

const MINIMAL_SELECT = 'id,title,status,description,slug,cover_image_url,created_at';

function normalizeBlogRow(raw: Record<string, unknown>): BlogListItem {
  const datePublished =
    typeof raw.date_published === 'string'
      ? raw.date_published
      : typeof raw.display_date === 'string'
        ? raw.display_date
        : null;

  return {
    id: String(raw.id),
    title: typeof raw.title === 'string' ? raw.title : '',
    status: raw.status === 'draft' ? 'draft' : 'published',
    description: typeof raw.description === 'string' ? raw.description : null,
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    cover_image_url: typeof raw.cover_image_url === 'string' ? raw.cover_image_url : null,
    date_published: datePublished,
    date_modified: typeof raw.date_modified === 'string' ? raw.date_modified : null,
    main_entity_of_page: typeof raw.main_entity_of_page === 'string' ? raw.main_entity_of_page : null,
  };
}

function isMissingCreatedAt(error: PostgrestError | null): boolean {
  return isMissingColumnError(error, 'created_at');
}

function isSchemaMismatchError(error: PostgrestError | null): boolean {
  if (!error) {
    return false;
  }
  if (error.code === '42703') {
    return true;
  }
  return /date_published|faq_schema|main_entity_of_page|display_date/i.test(error.message ?? '');
}

/**
 * List blogs for a site with schema-tolerant fallbacks.
 * Never returns an empty list when the real failure was a query error.
 */
export async function listBlogsForSite(siteId: string): Promise<DataLoadState<BlogListItem[]>> {
  if (!supabaseServiceRoleKeyStatus.valid) {
    return dataLoadFailure([], {
      message:
        `${supabaseServiceRoleKeyStatus.message ?? 'Invalid SUPABASE_SERVICE_ROLE_KEY'}. ` +
        `Admin blog list requires the service_role key. ${rlsConfigurationHint()}`,
      code: '42501',
    });
  }

  const ordered = await supabase
    .from('blogs')
    .select(FULL_SELECT)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  if (!ordered.error) {
    const rows = (ordered.data ?? []).map((row) => normalizeBlogRow(row as Record<string, unknown>));
    return dataLoadSuccess(rows);
  }

  reportError(ordered.error, { source: 'listBlogsForSite.full', siteId, code: ordered.error.code });

  if (!isSchemaMismatchError(ordered.error) && !isMissingCreatedAt(ordered.error)) {
    const err = isRlsPolicyError(ordered.error)
      ? {
          ...ordered.error,
          message: `${formatDbError(ordered.error)}. Admin cannot list blogs when the server uses the anon key. ${rlsConfigurationHint()}`,
        }
      : ordered.error;
    return dataLoadFailure([], err);
  }

  const legacy = await supabase
    .from('blogs')
    .select(LEGACY_SELECT)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false });

  if (!legacy.error) {
    const rows = (legacy.data ?? []).map((row) => normalizeBlogRow(row as Record<string, unknown>));
    return dataLoadSuccess(
      rows,
      `Blog list used legacy columns: ${formatDbError(ordered.error)}`,
    );
  }

  if (!isMissingCreatedAt(legacy.error)) {
    reportError(legacy.error, { source: 'listBlogsForSite.legacy', siteId });
    return dataLoadFailure([], legacy.error);
  }

  const minimal = await supabase
    .from('blogs')
    .select(MINIMAL_SELECT)
    .eq('site_id', siteId)
    .order('id', { ascending: false });

  if (minimal.error) {
    reportError(minimal.error, { source: 'listBlogsForSite.minimal', siteId });
    return dataLoadFailure([], minimal.error);
  }

  const rows = (minimal.data ?? []).map((row) => normalizeBlogRow(row as Record<string, unknown>));
  return dataLoadSuccess(
    rows,
    `Blog list used minimal fallback after: ${formatDbError(ordered.error)}`,
  );
}
