import type { NextApiRequest, NextApiResponse } from 'next';
import { assertSetupGateAllowed, verifyAdminSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase/server';

type SuccessResponse = {
  success: true;
  site: {
    id: string;
    name: string | null;
    domain: string;
    site_key: string;
  };
};

type ErrorResponse = {
  message: string;
};

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = verifyAdminSession(req);
  if (!auth.ok) {
    return res.status(401).json({ message: auth.message });
  }
  if (!assertSetupGateAllowed(req, res)) {
    return;
  }

  const { name, domain, site_key } = req.body ?? {};

  if (!site_key || typeof site_key !== 'string') {
    return res.status(400).json({ message: 'site_key is required' });
  }

  if (!SITE_KEY_REGEX.test(site_key)) {
    return res.status(400).json({ message: 'site_key can only include lowercase letters, numbers, and hyphens' });
  }

  const normalizedDomain = typeof domain === 'string' ? domain.trim() : '';
  const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : null;
  const normalizedSiteKey = site_key.trim().toLowerCase();

  const { data, error } = await supabase
    .from('sites')
    .insert([
      {
        name: normalizedName,
        domain: normalizedDomain,
        site_key: normalizedSiteKey,
      },
    ])
    .select('id,name,domain,site_key')
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'site_key must be unique' });
    }
    console.error('Error creating site:', error);
    return res.status(500).json({ message: 'Failed to create site' });
  }

  const defaultCategories = [
    { slug: 'lesson-planning', name: 'Lesson Planning', description: 'Practical guides and strategies for teachers', sort_order: 1 },
    { slug: 'curriculum-guides', name: 'Curriculum Guides', description: 'Curriculum-specific resources by system and country', sort_order: 2 },
    { slug: 'ai-in-education', name: 'AI in Education', description: 'Honest, research-grounded perspectives on AI in teaching', sort_order: 3 },
    { slug: 'teacher-wellbeing', name: 'Teacher Wellbeing', description: 'Workload, time management, and professional sustainability', sort_order: 4 },
    { slug: 'edtech', name: 'EdTech', description: 'Tools, trends, and what actually works in classrooms', sort_order: 5 },
  ];

  const { error: seedError } = await supabase.from('blog_categories').insert(
    defaultCategories.map((c) => ({ ...c, site_id: data.id })),
  );
  if (seedError) {
    console.warn('Default categories not seeded (run migrations or add in Categories UI):', seedError.message);
  }

  return res.status(200).json({
    success: true,
    site: data,
  });
}
