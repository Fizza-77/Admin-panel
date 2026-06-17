import type { NextApiRequest, NextApiResponse } from 'next';
import { assertSetupGateAllowed } from '@/lib/auth';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { recoverOrphanedSite } from '@/lib/sites/recoverOrphanedSite';
import { listOrphanedBlogSites } from '@/lib/sites/orphanedBlogSites';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { blogs: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (req.method === 'GET') {
    const { orphans, error } = await listOrphanedBlogSites();
    if (error) {
      return res.status(500).json({ message: error });
    }
    return res.status(200).json({ orphans });
  }

  if (req.method === 'POST') {
    if (!assertSetupGateAllowed(req, res)) {
      return;
    }

    const body = req.body ?? {};
    const site_id = typeof body.site_id === 'string' ? body.site_id : '';
    const site_key = typeof body.site_key === 'string' ? body.site_key : '';
    const domain = typeof body.domain === 'string' ? body.domain : '';
    const name = typeof body.name === 'string' ? body.name : null;

    const result = await recoverOrphanedSite({ site_id, site_key, domain, name });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    return res.status(201).json({ success: true, site: result.site });
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ message: 'Method Not Allowed' });
}
