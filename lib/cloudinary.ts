import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { env } from './env/server';
import { CLOUDINARY_UPLOAD_TIMEOUT_MS } from './upload/timeouts';

export { CLOUDINARY_UPLOAD_TIMEOUT_MS } from './upload/timeouts';
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

export async function uploadImage(file: Buffer | string, options: UploadApiOptions = {}): Promise<string> {
  const result = await uploadAsset(file, { ...options, resource_type: 'image' });
  return result.url;
}

export type UploadAssetResult = {
  url: string;
  resource_type: string;
  bytes?: number;
};

export type CloudinaryUploadError = {
  message?: string;
  http_code?: number;
  name?: string;
};

export function isCloudinaryTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const err = error as CloudinaryUploadError;
  return err.http_code === 499 || err.name === 'TimeoutError';
}

export function cloudinaryResourceTypeForMime(mime: string): 'image' | 'raw' {
  return mime.startsWith('image/') ? 'image' : 'raw';
}

function extensionFromMime(mime: string): string | undefined {
  const map: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
  };
  return map[mime];
}

function extensionFromFilename(filename: string): string | undefined {
  const match = filename.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase();
}

function buildUploadOptions(
  options: UploadApiOptions & { mimeType?: string; filename?: string },
): UploadApiOptions {
  const mimeType = options.mimeType ?? 'application/octet-stream';
  const resource_type = options.resource_type ?? cloudinaryResourceTypeForMime(mimeType);
  const format =
    resource_type === 'raw'
      ? extensionFromFilename(options.filename ?? '') ?? extensionFromMime(mimeType)
      : undefined;

  return {
    folder: options.folder ?? 'skyen/uploads',
    overwrite: options.overwrite,
    transformation: options.transformation,
    resource_type,
    timeout: options.timeout ?? CLOUDINARY_UPLOAD_TIMEOUT_MS,
    use_filename: resource_type === 'raw',
    unique_filename: resource_type === 'raw',
    ...(format ? { format } : {}),
  };
}

function uploadFromPathRegular(filePath: string, uploadOptions: UploadApiOptions): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(filePath, uploadOptions, (error, uploadResult) => {
      if (error || !uploadResult) {
        reject(error ?? new Error('Cloudinary upload failed'));
        return;
      }
      resolve(uploadResult);
    });
  });
}

export async function uploadAssetFromPath(
  filePath: string,
  options: UploadApiOptions & { mimeType?: string; filename?: string } = {},
): Promise<UploadAssetResult> {
  const uploadOptions = buildUploadOptions(options);
  const result = await uploadFromPathRegular(filePath, uploadOptions);

  return {
    url: result.secure_url,
    resource_type: result.resource_type,
    bytes: result.bytes,
  };
}

export async function uploadAsset(
  file: Buffer | string,
  options: UploadApiOptions & { mimeType?: string; filename?: string } = {},
): Promise<UploadAssetResult> {
  if (typeof file === 'string') {
    return uploadAssetFromPath(file, options);
  }

  const uploadOptions = buildUploadOptions(options);

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploadResult) => {
      if (error || !uploadResult) {
        return reject(error);
      }
      resolve(uploadResult);
    });

    uploadStream.end(file);
  });

  return {
    url: result.secure_url,
    resource_type: result.resource_type,
    bytes: result.bytes,
  };
}
