import type { NextApiRequest, NextApiResponse } from 'next';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { reportError } from '@/lib/monitoring';
import {
  attachmentContentDisposition,
  fetchCloudinaryAttachment,
  isAllowedCloudinaryUrl,
} from '@/lib/tasks/fetchCloudinaryAttachment';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  const fileUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  const fileName = typeof req.query.name === 'string' ? req.query.name.trim() : 'document';

  if (!fileUrl || !isAllowedCloudinaryUrl(fileUrl)) {
    return res.status(400).json({ message: 'Invalid attachment URL' });
  }

  try {
    const { buffer, contentType } = await fetchCloudinaryAttachment(fileUrl, null);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', attachmentContentDisposition(fileName, true));
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.status(200).send(buffer);
  } catch (fetchError) {
    reportError(fetchError, { source: 'api/tasks/attachments preview', fileUrl });
    return res.status(502).json({ message: 'Failed to load attachment file' });
  }
}
