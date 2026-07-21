import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { getAuthUserFromApiRequest } from '@/lib/auth';
import {
  DEFAULT_APP_PROFILE_FLAGS,
  fetchAppProfileRow,
  upsertAppProfileRow,
} from '@/lib/permissions/appProfileDb';
import { uploadImage } from '@/lib/cloudinary';
import { formatDbError } from '@/lib/db/errors';
import { reportError } from '@/lib/monitoring';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BYTES = 5 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const user = await getAuthUserFromApiRequest(req, res);
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
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
      folder: `skyen/avatars/${user.id}`,
      overwrite: true,
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto' }],
    });

    const { row: existing, error: readErr } = await fetchAppProfileRow(user.id);
    if (readErr) {
      reportError(readErr, { source: 'api/profile/avatar read', userId: user.id });
      return res.status(500).json({ message: formatDbError(readErr) });
    }

    const flags = existing ?? DEFAULT_APP_PROFILE_FLAGS;
    const result = await upsertAppProfileRow({
      user_id: user.id,
      can_manage_blogs: flags.can_manage_blogs,
      can_manage_tasks: flags.can_manage_tasks,
      can_administer_tasks: flags.can_administer_tasks,
      can_manage_users: flags.can_manage_users,
      can_manage_attendance: flags.can_manage_attendance,
      can_manage_expenses: flags.can_manage_expenses,
      can_manage_profiles: flags.can_manage_profiles,
      can_manage_payroll: flags.can_manage_payroll,
      display_name: existing?.display_name ?? null,
      avatar_url,
    });

    if (!result.ok) {
      reportError(result.error, { source: 'api/profile/avatar upsert', userId: user.id });
      return res.status(500).json({ message: formatDbError(result.error) });
    }

    return res.status(200).json({ avatar_url });
  } catch (error) {
    reportError(error, { source: 'api/profile/avatar upload', userId: user.id });
    return res.status(500).json({ message: 'Failed to upload profile photo.' });
  }
}
