/** Client-safe upload timeout shared with server Cloudinary uploads. */
export const CLOUDINARY_UPLOAD_TIMEOUT_MS = 180_000;

/** Extra buffer for browser → API round trip. */
export const CLIENT_UPLOAD_TIMEOUT_MS = CLOUDINARY_UPLOAD_TIMEOUT_MS + 30_000;
