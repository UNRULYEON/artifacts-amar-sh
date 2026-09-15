import { Effect } from 'effect'
import type { Route } from '../http'
import { contentTypeFor } from '../mime'
import { contentRange, parseRange, type ByteRange } from '../range'
import { Artifacts, type ArtifactFileRow, type ArtifactRow } from '../services/artifacts'
import { Signer } from '../services/signer'
import { Storage } from '../services/storage'
import { LOCAL_HEADER_MIN, localHeaderSize } from '../zip'

// Serves artifact bytes under the signed prefix. No cookie is read here, and
// every response is sandboxed so report scripts run in an opaque origin.

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

// The sandbox makes localStorage and sessionStorage throw, which breaks reports
// such as Playwright's. Pages get an in-memory store only where access throws.
const storageShim = `<script>(function(){function m(){var d=new Map();return{get length(){return d.size},key:function(i){var k=Array.from(d.keys())[i];return k===undefined?null:k},getItem:function(k){k=String(k);return d.has(k)?d.get(k):null},setItem:function(k,v){d.set(String(k),String(v))},removeItem:function(k){d.delete(String(k))},clear:function(){d.clear()}}}['localStorage','sessionStorage'].forEach(function(n){try{window[n]}catch(e){Object.defineProperty(window,n,{value:m(),configurable:true})}})})()</script>`

export function withStorageShim(response: Response) {
  const html = response.headers.get('content-type')?.startsWith('text/html')
  if (response.status !== 200 || !html || response.headers.has('content-disposition')) {
    return response
  }
  response.headers.delete('content-length')
  let done = false
  return new HTMLRewriter()
    .on('head', {
      element(head) {
        if (done) return
        done = true
        head.prepend(storageShim, { html: true })
      },
    })
    .transform(response)
}

export function bundlePath(root: string, path: string) {
  return root === '' ? path : `${root}/${path}`
}

function baseHeaders(name: string, download: boolean) {
  const type = contentTypeFor(name)
  const headers = new Headers({
    'content-security-policy': 'sandbox allow-scripts',
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=300',
    'accept-ranges': 'bytes',
    'content-type': type ?? 'application/octet-stream',
  })
  if (download || type === null) {
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
    const signer = yield* Signer
    if (!(yield* signer.verify(id, token))) {
      return page(
        403,
        'Link expired',
        `<a href="/a/${id}">Open the artifact again</a> to get a fresh link.`,
      )
    }
    const artifacts = yield* Artifacts
    const row = yield* artifacts
      .get(id)
      .pipe(Effect.catchTag('NotFound', () => Effect.succeed(null)))
    if (!row) return page(404, 'Not found', 'This artifact is gone.')

    const path = decodeURIComponent(rawPath)
    const download = new URL(request.url).searchParams.has('download')
    const range = request.method === 'GET' ? request.headers.get('range') : null

    if (row.kind === 'bundle' || row.kind === 'compare') {
      const entry = yield* artifacts.file(id, bundlePath(row.rootPath, path))
      if (entry) return withStorageShim(yield* serveEntry(row, entry, path, range, download))
      if (path !== row.name) return page(404, 'Not found', 'No such file in this bundle.')
    } else if (path !== row.name) {
      return page(404, 'Not found', 'No such file.')
    }
    return withStorageShim(yield* serveWhole(row, range, download))
  }).pipe(Effect.withSpan('serveBytes'))
}

function serveWhole(row: ArtifactRow, rangeHeader: string | null, download: boolean) {
  return Effect.gen(function* () {
    const storage = yield* Storage
    const headers = baseHeaders(row.name, download)
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
  download: boolean,
) {
  return Effect.gen(function* () {
    const storage = yield* Storage
    const headers = baseHeaders(path, download)
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
