import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { supabase } from '@/lib/supabase/server';

type SiteRecord = {
  id: string;
  name: string | null;
  domain: string;
  site_key: string;
  blog_page_meta_title?: string | null;
  blog_page_meta_description?: string | null;
  blog_page_headline?: string | null;
  blog_page_subheadline?: string | null;
  blog_empty_state_message?: string | null;
};

type SuccessResponse = {
  success: true;
  site: SiteRecord;
};

type ErrorResponse = {
  message: string;
};

const SITE_KEY_REGEX = /^[a-z0-9-]+$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', ['PATCH']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const token = req.cookies.admin_session;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { siteId } = req.query;
  if (typeof siteId !== 'string') {
    return res.status(400).json({ message: 'Invalid site id' });
  }

  const body = req.body ?? {};
  const { name, domain, site_key } = body;
  if (!site_key || typeof site_key !== 'string') {
    return res.status(400).json({ message: 'site_key is required' });
  }

  const normalizedSiteKey = site_key.trim().toLowerCase();
  if (!SITE_KEY_REGEX.test(normalizedSiteKey)) {
    return res.status(400).json({ message: 'site_key can only include lowercase letters, numbers, and hyphens' });
  }

  const normalizedDomain = typeof domain === 'string' ? domain.trim() : '';
  const normalizedName = typeof name === 'string' && name.trim() ? name.trim() : null;

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

  const { data, error } = await supabase
    .from('sites')
    .update({
      name: normalizedName,
      domain: normalizedDomain,
      site_key: normalizedSiteKey,
      ...(str(body.blog_page_meta_title) !== undefined && {
        blog_page_meta_title: str(body.blog_page_meta_title)!.trim() || null,
      }),
      ...(str(body.blog_page_meta_description) !== undefined && {
        blog_page_meta_description: str(body.blog_page_meta_description)!.trim() || null,
      }),
      ...(str(body.blog_page_headline) !== undefined && {
        blog_page_headline: str(body.blog_page_headline)!.trim() || null,
      }),
      ...(str(body.blog_page_subheadline) !== undefined && {
        blog_page_subheadline: str(body.blog_page_subheadline)!.trim() || null,
      }),
      ...(str(body.blog_empty_state_message) !== undefined && {
        blog_empty_state_message: str(body.blog_empty_state_message)!.trim() || null,
      }),
    })
    .eq('id', siteId)
    .select(
      'id,name,domain,site_key,blog_page_meta_title,blog_page_meta_description,blog_page_headline,blog_page_subheadline,blog_empty_state_message',
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'site_key must be unique' });
    }
    console.error('Error updating site:', error);
    return res.status(500).json({ message: 'Failed to update site' });
  }

  return res.status(200).json({
    success: true,
    site: data,
  });
}
