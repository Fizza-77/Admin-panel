import { supabase } from '@/lib/supabase/server';
import { formatDbError } from '@/lib/db/errors';
import { countBlogsForSiteId, lookupSiteById, normalizeSiteId } from './getSiteById';

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

export type RecoverOrphanedSiteInput = {
  site_id: string;
  name: string | null;
  domain: string;
  site_key: string;
};

export type RecoverOrphanedSiteResult =
  | { ok: true; site: { id: string; name: string | null; domain: string; site_key: string } }
  | { ok: false; status: number; message: string };

export async function recoverOrphanedSite(input: RecoverOrphanedSiteInput): Promise<RecoverOrphanedSiteResult> {
  const siteId = normalizeSiteId(input.site_id);
  if (!siteId) {
    return { ok: false, status: 400, message: 'Invalid site id' };
  }

  const existing = await lookupSiteById(siteId);
  if (existing.ok) {
    return {
      ok: true,
      site: {
        id: existing.site.id,
        name: existing.site.name,
        domain: existing.site.domain,
        site_key: existing.site.site_key,
      },
    };
  }
  if (existing.reason === 'query_error') {
    return { ok: false, status: 500, message: existing.message };
  }

  const blogCount = await countBlogsForSiteId(siteId);
  if (blogCount === 0) {
    return {
      ok: false,
      status: 404,
      message: 'No blogs exist for this site id. Use Add site to create a new site instead.',
    };
  }

  const site_key = input.site_key.trim().toLowerCase();
  if (!site_key || !SITE_KEY_REGEX.test(site_key)) {
    return {
      ok: false,
      status: 400,
      message: 'site_key is required and may only use lowercase letters, numbers, and hyphens',
    };
  }

  const domain = input.domain.trim();
  const name = input.name?.trim() || null;

  const { data, error } = await supabase
    .from('sites')
    .insert([
      {
        id: siteId,
        name,
        domain,
        site_key,
      },
    ])
    .select('id,name,domain,site_key')
    .single();

  if (error) {
    if (error.code === '23505') {
      return { ok: false, status: 409, message: 'site_key must be unique' };
    }
    return { ok: false, status: 500, message: formatDbError(error) };
  }

  const defaultCategories = [
    { slug: 'lesson-planning', name: 'Lesson Planning', description: 'Practical guides and strategies for teachers', sort_order: 1 },
    { slug: 'curriculum-guides', name: 'Curriculum Guides', description: 'Curriculum-specific resources by system and country', sort_order: 2 },
    { slug: 'ai-in-education', name: 'AI in Education', description: 'Honest, research-grounded perspectives on AI in teaching', sort_order: 3 },
    { slug: 'teacher-wellbeing', name: 'Teacher Wellbeing', description: 'Workload, time management, and professional sustainability', sort_order: 4 },
    { slug: 'edtech', name: 'EdTech', description: 'Tools, trends, and what actually works in classrooms', sort_order: 5 },
  ];

  const { error: seedError } = await supabase.from('blog_categories').insert(
    defaultCategories.map((c) => ({ ...c, site_id: siteId })),
  );
  if (seedError) {
    console.warn('Default categories not seeded for recovered site:', seedError.message);
  }

  return { ok: true, site: data };
}
