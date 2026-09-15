import { Config, Effect } from 'effect'
import { contentOrigin } from '../content'
import type { Route } from '../http'
import { contentTypeFor } from '../mime'
import { contentRange, parseRange, type ByteRange } from '../range'
import { Artifacts, type ArtifactFileRow, type ArtifactRow } from '../services/artifacts'
import { Signer } from '../services/signer'
import { Storage } from '../services/storage'
import { LOCAL_HEADER_MIN, localHeaderSize } from '../zip'

// Serves artifact bytes under the signed prefix. No cookie is read here, and
// every response is sandboxed. On the content origin scripts keep that origin,
// so reports can use storage. On the app origin they run in an opaque origin.

function page(status: number, title: string, body: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:14px system-ui;margin:3rem auto;max-width:32rem;color:#333}</style><h1>${title}</h1><p>${body}</p>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': "default-src 'none'",
        'cache-control': 'no-store',
      },
    },
  )
}

export function bundlePath(root: string, path: string) {
  return root === '' ? path : `${root}/${path}`
}

interface Served {
  download: boolean
  // Set only on the content origin, for CORS and links back to the app.
  app: string | null
}

function baseHeaders(name: string, served: Served) {
  const type = contentTypeFor(name)
  const headers = new Headers({
    'content-security-policy': served.app
      ? 'sandbox allow-scripts allow-same-origin'
      : 'sandbox allow-scripts',
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=300',
    'accept-ranges': 'bytes',
    'content-type': type ?? 'application/octet-stream',
  })
  if (served.app) headers.set('access-control-allow-origin', served.app)
  if (served.download || type === null) {
    const file = name.slice(name.lastIndexOf('/') + 1).replaceAll('"', '')
    headers.set('content-disposition', `attachment; filename="${file}"`)
  }
  return headers
}

function unsatisfiable(size: number, headers: Headers) {
  headers.set('content-range', `bytes */${size}`)
  return new Response(null, { status: 416, headers })
}

export function serveBytes(request: Request, id: string, token: string, rawPath: string): Route {
  return Effect.gen(function* () {
    const origin = new URL(request.url).origin
    const app = (yield* contentOrigin('')) === origin ? yield* Config.string('APP_URL') : null
    const signer = yield* Signer
    if (!(yield* signer.verify(id, token))) {
      return page(
        403,
        'Link expired',
        `<a href="${app ?? ''}/a/${id}">Open the artifact again</a> to get a fresh link.`,
      )
    }
    const artifacts = yield* Artifacts
    const row = yield* artifacts
      .get(id)
      .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
    if (!row) return page(404, 'Not found', 'This artifact is gone.')

    const path = decodeURIComponent(rawPath)
    const served = { download: new URL(request.url).searchParams.has('download'), app }
    const range = request.method === 'GET' ? request.headers.get('range') : null

    if (row.kind === 'bundle' || row.kind === 'compare') {
      const entry = yield* artifacts.file(id, bundlePath(row.rootPath, path))
      if (entry) return yield* serveEntry(row, entry, path, range, served)
      if (path !== row.name) return page(404, 'Not found', 'No such file in this bundle.')
    } else if (path !== row.name) {
      return page(404, 'Not found', 'No such file.')
    }
    return yield* serveWhole(row, range, served)
  }).pipe(Effect.withSpan('serveBytes'))
}

function serveWhole(row: ArtifactRow, rangeHeader: string | null, served: Served) {
  return Effect.gen(function* () {
    const storage = yield* Storage
    const headers = baseHeaders(row.name, served)
    const range = parseRange(rangeHeader, row.size)
    if (range === 'unsatisfiable') return unsatisfiable(row.size, headers)
    const object = yield* storage.get(row.r2Key, range ? { range } : undefined)
    if (!object) return page(404, 'Not found', 'The bytes are gone.')
    return partial(object.body, range, row.size, headers)
  })
}

function serveEntry(
  row: ArtifactRow,
  entry: ArtifactFileRow,
  path: string,
  rangeHeader: string | null,
  served: Served,
) {
  return Effect.gen(function* () {
    const storage = yield* Storage
    const headers = baseHeaders(path, served)
    const header = yield* storage.get(row.r2Key, {
      range: { offset: entry.offset, length: LOCAL_HEADER_MIN },
    })
    if (!header) return page(404, 'Not found', 'The bytes are gone.')
    const headerBytes = new Uint8Array(yield* Effect.promise(() => header.arrayBuffer()))
    const dataOffset = entry.offset + localHeaderSize(headerBytes)

    if (entry.method === 0) {
      const range = parseRange(rangeHeader, entry.size)
      if (range === 'unsatisfiable') return unsatisfiable(entry.size, headers)
      const slice: ByteRange = range
        ? { offset: dataOffset + range.offset, length: range.length }
        : { offset: dataOffset, length: entry.size }
      const object = yield* storage.get(row.r2Key, { range: slice })
      if (!object) return page(404, 'Not found', 'The bytes are gone.')
      return partial(object.body, range, entry.size, headers)
    }

    const object = yield* storage.get(row.r2Key, {
      range: { offset: dataOffset, length: entry.compressedSize },
    })
    if (!object) return page(404, 'Not found', 'The bytes are gone.')
    const body = object.body.pipeThrough(new DecompressionStream('deflate-raw'))
    return new Response(body, { status: 200, headers })
  })
}

function partial(body: ReadableStream, range: ByteRange | null, size: number, headers: Headers) {
  if (range) {
    headers.set('content-range', contentRange(range, size))
    headers.set('content-length', String(range.length))
    return new Response(body, { status: 206, headers })
  }
  headers.set('content-length', String(size))
  return new Response(body, { status: 200, headers })
}
