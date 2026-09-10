export type Kind = 'image' | 'video' | 'bundle' | 'page' | 'file'

const kinds: Record<string, Kind> = {
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  gif: 'image',
  mp4: 'video',
  webm: 'video',
  zip: 'bundle',
  html: 'page',
}

const types: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  zip: 'application/zip',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json',
  map: 'application/json',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  log: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  pdf: 'application/pdf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  webmanifest: 'application/manifest+json',
}

export function extensionOf(name: string) {
  const base = name.slice(name.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

// From the name only. The client Content-Type is never trusted.
export function kindFor(name: string): Kind {
  return kinds[extensionOf(name)] ?? 'file'
}

// null means unknown: serve as octet-stream with an attachment disposition.
export function contentTypeFor(name: string): string | null {
  return types[extensionOf(name)] ?? null
}
