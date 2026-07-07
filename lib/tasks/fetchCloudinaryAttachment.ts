import { env } from '@/lib/env/server';

export function isAllowedCloudinaryUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
      return false;
    }
    return parsed.pathname.includes(`/${env.CLOUDINARY_CLOUD_NAME}/`);
  } catch {
    return false;
  }
}

function alternateCloudinaryUrls(fileUrl: string, fileType: string | null): string[] {
  const urls = [fileUrl];

  if (fileType === 'application/pdf') {
    if (fileUrl.includes('/image/upload/')) {
      urls.push(fileUrl.replace('/image/upload/', '/raw/upload/'));
    }
    if (fileUrl.includes('/raw/upload/')) {
      urls.push(fileUrl.replace('/raw/upload/', '/image/upload/'));
    }
  }

  return Array.from(new Set(urls));
}

export async function fetchCloudinaryAttachment(
  fileUrl: string,
  fileType: string | null,
): Promise<{ buffer: Buffer; contentType: string }> {
  const candidates = alternateCloudinaryUrls(fileUrl, fileType);
  let lastError: unknown = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`Upstream responded with ${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType =
        response.headers.get('content-type') ||
        fileType ||
        'application/octet-stream';

      return { buffer, contentType };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Failed to fetch attachment');
}

export function attachmentContentDisposition(fileName: string, inline: boolean): string {
  const safeName = fileName.replace(/[^\w.\-()+\s]/g, '_').trim() || 'document';
  return `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`;
}
