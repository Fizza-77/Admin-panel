import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import { canSetEmployeeProfiles } from '@/lib/permissions/profileAccess';
import {
  fetchAppProfileRow,
  updateEmployeeAvatarUrl,
} from '@/lib/permissions/appProfileDb';
import { uploadImage } from '@/lib/cloudinary';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';
import { mapEmployeeProfile } from '@/lib/employees/profile';
import { supabase } from '@/lib/supabase/server';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireApiPermission(req, res, { profiles: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ message: auth.message });
  }

  if (!canSetEmployeeProfiles(auth.permissions)) {
    return res.status(403).json({ message: 'You do not have permission to set employee profiles.' });
  }

  const userId = req.query.userId;
  if (typeof userId !== 'string') {
    return res.status(400).json({ message: 'Invalid user id' });
  }

  const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
  if (authErr || !authUser?.user) {
    reportError(authErr ?? new Error('User not found'), { source: 'api/employees avatar user', userId });
    return res.status(404).json({ message: 'Employee not found' });
  }

  if (req.method === 'DELETE') {
    const result = await updateEmployeeAvatarUrl(userId, null);
    if (!result.ok) {
      reportError(result.error, { source: 'api/employees avatar DELETE', userId });
      return res.status(500).json({ message: formatDbError(result.error) });
    }
    const { row } = await fetchAppProfileRow(userId);
    return res.status(200).json({
      avatar_url: null,
      employee: mapEmployeeProfile(userId, authUser.user.email, row),
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'DELETE']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: MAX_BYTES,
  });

  try {
    const { files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>(
      (resolve, reject) => {
        form.parse(req, (err, _fields, parsedFiles) => {
          if (err) {
            return reject(err);
          }
          resolve({ fields: _fields, files: parsedFiles });
        });
      },
    );

    const file = files.file as File | File[] | undefined;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const singleFile = Array.isArray(file) ? file[0] : file;
    if (!singleFile.filepath) {
      return res.status(400).json({ message: 'Invalid file upload.' });
    }

    const mime = singleFile.mimetype || '';
    if (!mime.startsWith('image/')) {
      return res.status(400).json({ message: 'Please upload a JPG, PNG, or WEBP image.' });
    }

    const fileBuffer = await fs.promises.readFile(singleFile.filepath);
    if (fileBuffer.length > MAX_BYTES) {
      return res.status(400).json({ message: 'Image must be 5 MB or smaller.' });
    }

    const avatar_url = await uploadImage(fileBuffer, {
      folder: `skyen/avatars/${userId}`,
      overwrite: true,
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
    });

    const result = await updateEmployeeAvatarUrl(userId, avatar_url);
    if (!result.ok) {
      reportError(result.error, { source: 'api/employees avatar POST', userId });
      return res.status(500).json({ message: formatDbError(result.error) });
    }

    const { row } = await fetchAppProfileRow(userId);
    return res.status(200).json({
      avatar_url,
      employee: mapEmployeeProfile(userId, authUser.user.email, row),
    });
  } catch (error) {
    reportError(error, { source: 'api/employees avatar upload', userId, actorUserId: auth.userId });
    return res.status(500).json({ message: 'Failed to upload profile photo.' });
  }
}
