export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024
export const MAX_ZIP_ENTRIES = 5000
export const MAX_CENTRAL_DIRECTORY_BYTES = 8 * 1024 * 1024
export const MIN_TTL_SECONDS = 60
export const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60
export const MAX_TTL_SECONDS = 90 * 24 * 60 * 60

export function clampTtl(ttlSeconds: number) {
  return Math.min(Math.max(ttlSeconds, MIN_TTL_SECONDS), MAX_TTL_SECONDS)
}
