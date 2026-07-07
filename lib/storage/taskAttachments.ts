import fs from 'fs';
import { randomUUID } from 'crypto';
import { supabase } from '@/lib/supabase/server';

export const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

/** Prefix that marks a `file_url` value as a Supabase Storage object path. */
const STORAGE_URL_PREFIX = 'supabase://';

const EXTENSION_BY_MIME: Record<string, string> = {
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

function extensionFor(filename: string, mimeType: string): string {
  const fromName = filename.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  if (fromName) {
    return fromName;
  }
  return EXTENSION_BY_MIME[mimeType] ?? 'bin';
}

export function isSupabaseStorageUrl(fileUrl: string): boolean {
  return fileUrl.startsWith(STORAGE_URL_PREFIX);
}

export function storagePathFromUrl(fileUrl: string): string {
  return fileUrl.slice(STORAGE_URL_PREFIX.length);
}

export function storageUrlFromPath(path: string): string {
  return `${STORAGE_URL_PREFIX}${path}`;
}

export type StoredAttachment = {
  fileUrl: string;
  bytes: number | null;
};

/** Uploads a file from a temp path to the private task-attachments bucket. */
export async function uploadTaskAttachmentFromPath(
  filePath: string,
  options: { mimeType: string; filename: string },
): Promise<StoredAttachment> {
  const body = await fs.promises.readFile(filePath);
  const ext = extensionFor(options.filename, options.mimeType);
  const objectPath = `tasks/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .upload(objectPath, body, {
      contentType: options.mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    fileUrl: storageUrlFromPath(objectPath),
    bytes: body.byteLength,
  };
}

/** Downloads a stored attachment. Returns the raw bytes and content type. */
export async function downloadTaskAttachment(
  fileUrl: string,
  fileType: string | null,
): Promise<{ buffer: Buffer; contentType: string }> {
  const objectPath = storagePathFromUrl(fileUrl);
  const { data, error } = await supabase.storage
    .from(TASK_ATTACHMENTS_BUCKET)
    .download(objectPath);

  if (error || !data) {
    throw error ?? new Error('Failed to download attachment from storage');
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || fileType || 'application/octet-stream';
  return { buffer, contentType };
}
