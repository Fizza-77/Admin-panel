export type TaskAttachment = {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
};

export type PendingTaskAttachment = {
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
};

const ALLOWED_MIME_PREFIXES = ['image/'];
const ALLOWED_MIME_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

export const TASK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function isAllowedTaskAttachmentType(mime: string): boolean {
  if (!mime) {
    return false;
  }
  if (ALLOWED_MIME_EXACT.has(mime)) {
    return true;
  }
  return ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Opens via our API proxy so PDFs/docs work even when Cloudinary blocks direct browser delivery. */
export function taskAttachmentOpenHref(file: {
  id?: string;
  file_url: string;
  file_name: string;
}): string {
  if (file.id) {
    return `/api/tasks/attachments/${file.id}`;
  }

  const params = new URLSearchParams({
    url: file.file_url,
    name: file.file_name,
  });
  return `/api/tasks/attachments/preview?${params.toString()}`;
}

export function parseAttachmentInput(raw: unknown): PendingTaskAttachment | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const file_name = typeof o.file_name === 'string' ? o.file_name.trim() : '';
  const file_url = typeof o.file_url === 'string' ? o.file_url.trim() : '';
  const isValidUrl = file_url.startsWith('https://') || file_url.startsWith('supabase://');
  if (!file_name || !file_url || !isValidUrl) {
    return null;
  }
  const file_type = typeof o.file_type === 'string' ? o.file_type : null;
  const file_size =
    typeof o.file_size === 'number' && Number.isFinite(o.file_size) ? Math.round(o.file_size) : null;
  return { file_name, file_url, file_type, file_size };
}
