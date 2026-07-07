import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { requireApiPermission } from '@/lib/permissions/apiGuard';
import {
  isAllowedTaskAttachmentType,
  TASK_ATTACHMENT_MAX_BYTES,
} from '@/lib/tasks/taskAttachments';
import { uploadTaskAttachmentFromPath } from '@/lib/storage/taskAttachments';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

async function removeTempFile(filePath: string | undefined) {
  if (!filePath) {
    return;
  }
  try {
    await fs.promises.unlink(filePath);
  } catch {
    /* ignore cleanup errors */
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await requireApiPermission(req, res, { tasks: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  const form = formidable({
    multiples: false,
    maxFiles: 1,
    maxFileSize: TASK_ATTACHMENT_MAX_BYTES,
  });

  let tempFilePath: string | undefined;

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
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const singleFile = Array.isArray(file) ? file[0] : file;
    if (!singleFile.filepath) {
      return res.status(400).json({ error: 'Invalid file upload.' });
    }

    tempFilePath = singleFile.filepath;

    const mime = singleFile.mimetype || 'application/octet-stream';
    if (!isAllowedTaskAttachmentType(mime)) {
      return res.status(400).json({
        error: 'File type not allowed. Use PDF, Word, Excel, PowerPoint, images, or plain text.',
      });
    }

    if ((singleFile.size ?? 0) > TASK_ATTACHMENT_MAX_BYTES) {
      return res.status(400).json({ error: 'File must be 10 MB or smaller.' });
    }

    const originalName = singleFile.originalFilename || 'document';
    const result = await uploadTaskAttachmentFromPath(singleFile.filepath, {
      mimeType: mime,
      filename: originalName,
    });

    return res.status(200).json({
      file_name: originalName,
      file_url: result.fileUrl,
      file_type: mime,
      file_size: singleFile.size ?? result.bytes ?? null,
    });
  } catch (error) {
    console.error('Task attachment upload error:', error);
    return res.status(500).json({ error: 'Failed to upload file.' });
  } finally {
    await removeTempFile(tempFilePath);
  }
}
