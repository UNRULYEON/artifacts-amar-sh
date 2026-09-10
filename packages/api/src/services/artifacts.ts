import { schema } from '@artifacts/db'
import { Effect } from 'effect'
import { BadRequest } from '../errors'
import { newId } from '../id'
import { DEFAULT_TTL_SECONDS, clampTtl } from '../limits'
import { contentTypeFor, kindFor } from '../mime'
import {
  EOCD_TAIL_BYTES,
  ZipError,
  detectRoot,
  findCentralDirectory,
  parseEntries,
  type ZipEntry,
} from '../zip'
import { Database } from './database'
import { Storage } from './storage'

const { artifact, artifactFile } = schema

// D1 allows 100 bound parameters per statement; artifact_file has 7 columns.
const FILE_ROWS_PER_INSERT = 14

export interface UploadInput {
  userId: string
  project: { id: string; ttlSeconds: number | null }
  name: string
  size: number
  body: ReadableStream
  ttlSeconds?: number
  uploadedBy: string
}

export interface Uploaded {
  id: string
  expiresAt: string
}

export function objectKey(userId: string, projectId: string, artifactId: string) {
  return `users/${userId}/projects/${projectId}/artifacts/${artifactId}`
}

// A DataView overrun on a corrupt directory is a bad zip too.
function zipFailure(e: unknown) {
  return new BadRequest({ message: e instanceof ZipError ? e.message : 'Corrupt zip file.' })
}

export class Artifacts extends Effect.Service<Artifacts>()('@artifacts/api/Artifacts', {
  effect: Effect.gen(function* () {
    const db = yield* Database
    const storage = yield* Storage

    function readRange(key: string, range: R2Range) {
      return Effect.flatMap(storage.get(key, { range }), (object) =>
        object
          ? Effect.promise(() => object.arrayBuffer()).pipe(Effect.map((b) => new Uint8Array(b)))
          : Effect.fail(new BadRequest({ message: 'Upload vanished before indexing.' })),
      )
    }

    // Reads the zip tail from R2 and returns the entry list. Never the whole file.
    function indexZip(key: string, size: number) {
      return Effect.gen(function* () {
        const tail = yield* readRange(key, { suffix: Math.min(size, EOCD_TAIL_BYTES) })
        const cd = yield* Effect.try({
          try: () => findCentralDirectory(tail, size),
          catch: zipFailure,
        })
        const tailStart = size - tail.byteLength
        const bytes =
          cd.offset >= tailStart
            ? tail.subarray(cd.offset - tailStart, cd.offset - tailStart + cd.size)
            : yield* readRange(key, { offset: cd.offset, length: cd.size })
        return yield* Effect.try({
          try: () => parseEntries(bytes, cd.entryCount),
          catch: zipFailure,
        })
      }).pipe(Effect.withSpan('Artifacts.indexZip'))
    }

    function insertFiles(artifactId: string, entries: ZipEntry[]) {
      const chunks: ZipEntry[][] = []
      for (let i = 0; i < entries.length; i += FILE_ROWS_PER_INSERT) {
        chunks.push(entries.slice(i, i + FILE_ROWS_PER_INSERT))
      }
      return Effect.forEach(
        chunks,
        (chunk) => db.insert(artifactFile).values(chunk.map((e) => ({ artifactId, ...e }))),
        { discard: true },
      )
    }

    // The one upload path for HTTP, tickets, and MCP.
    function upload(input: UploadInput) {
      return Effect.gen(function* () {
        const id = newId('art')
        const key = objectKey(input.userId, input.project.id, id)
        const kind = kindFor(input.name)
        const contentType = contentTypeFor(input.name) ?? 'application/octet-stream'

        const object = yield* storage.put(key, input.body, { httpMetadata: { contentType } })
        if (object.size !== input.size) {
          yield* storage.delete(key).pipe(Effect.ignore)
          return yield* new BadRequest({
            message: `Body was ${object.size} bytes, Content-Length said ${input.size}.`,
          })
        }

        const record = Effect.gen(function* () {
          const entries = kind === 'bundle' ? yield* indexZip(key, input.size) : []
          const ttl = clampTtl(input.ttlSeconds ?? input.project.ttlSeconds ?? DEFAULT_TTL_SECONDS)
          const now = new Date()
          const expiresAt = new Date(now.getTime() + ttl * 1000)
          yield* db.insert(artifact).values({
            id,
            userId: input.userId,
            projectId: input.project.id,
            name: input.name,
            kind,
            size: input.size,
            r2Key: key,
            rootPath: detectRoot(entries),
            uploadedBy: input.uploadedBy,
            createdAt: now,
            expiresAt,
          })
          yield* insertFiles(id, entries)
          return { id, expiresAt: expiresAt.toISOString() } satisfies Uploaded
        })

        // Any failure after the put leaves no orphan bytes behind.
        return yield* record.pipe(Effect.tapError(() => storage.delete(key).pipe(Effect.ignore)))
      }).pipe(Effect.withSpan('Artifacts.upload'))
    }

    return { upload }
  }),
}) {}
