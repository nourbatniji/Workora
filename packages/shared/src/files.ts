// FND-06 / NFR-3: shared upload limits for the API and future file forms.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;
export type FileMimeType = (typeof FILE_MIME_TYPES)[number];
export const FILE_LINK_TTL_SECONDS = 300;
