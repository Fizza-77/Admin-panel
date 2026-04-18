import type { NextApiRequest, NextApiResponse } from 'next';
import formidable, { File } from 'formidable';
import fs from 'fs';
import { uploadImage } from '@/lib/cloudinary';
import { requireApiPermission } from '@/lib/permissions/apiGuard';

export const config = {
  api: {
    bodyParser: false,
  },
};

type UploadResponse = {
  url: string;
};

type ErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const auth = await requireApiPermission(req, res, { blogs: true });
  if (!auth.ok) {
    return res.status(auth.status).json({ error: auth.message });
  }

  const form = formidable({
    multiples: false,
    maxFiles: 1,
  });

  try {
    const { files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>(
      (resolve, reject) => {
        form.parse(req, (err, fields, parsedFiles) => {
          if (err) return reject(err);
          resolve({ fields, files: parsedFiles });
        });
      },
    );

    const file = files.file as File | File[] | undefined;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded under \"file\" field.' });
    }

    const singleFile = Array.isArray(file) ? file[0] : file;

    if (!singleFile.filepath) {
      return res.status(400).json({ error: 'Invalid file upload.' });
    }

    const fileBuffer = await fs.promises.readFile(singleFile.filepath);

    const url = await uploadImage(fileBuffer);

    return res.status(200).json({ url });
  } catch (error) {
    console.error('Image upload error:', error);
    return res.status(500).json({ error: 'Failed to upload image.' });
  }
}