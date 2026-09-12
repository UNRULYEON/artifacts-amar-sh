import { schema } from '@artifacts/db'
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm'
import { Effect } from 'effect'
import { BadRequest, NotFound } from '../errors'
import { newId } from '../id'
import { clampTtl } from '../limits'
import { contentTypeFor, kindFor } from '../mime'
import {
  EOCD_TAIL_BYTES,
  ZipError,
  comparePairs,
  detectRoot,
  findCentralDirectory,
  parseEntries,
  type ZipEntry,
} from '../zip'
import { Database } from './database'
import { Storage } from './storage'

const { artifact, artifactFile, token } = schema

// D1 allows 100 bound parameters per statement; artifact_file has 7 columns.
const FILE_ROWS_PER_INSERT = 14

export interface UploadInput {
  userId: string
  projectId: string
  name: string
  size: number
  body: ReadableStream
  // Already resolved from request, project, and user default. Clamped here.
  ttlSeconds: number
  uploadedBy: string
}

export type ArtifactRow = typeof artifact.$inferSelect
export type ArtifactFileRow = typeof artifactFile.$inferSelect

export interface ArtifactSummary {
  id: string
  name: string
  kind: ArtifactRow['kind']
  size: number
  uploadedBy: string
  createdAt: string
  expiresAt: string
}

export interface Uploaded {
  id: string
  kind: ArtifactRow['kind']
  name: string
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
        const key = objectKey(input.userId, input.projectId, id)
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
          const stored = kind === 'bundle' && comparePairs(entries) ? 'compare' : kind
          const ttl = clampTtl(input.ttlSeconds)
          const now = new Date()
          const expiresAt = new Date(now.getTime() + ttl * 1000)
          yield* db.insert(artifact).values({
            id,
            userId: input.userId,
            projectId: input.projectId,
            name: input.name,
            kind: stored,
            size: input.size,
            r2Key: key,
            rootPath: detectRoot(entries),
            uploadedBy: input.uploadedBy,
            createdAt: now,
            expiresAt,
          })
          yield* insertFiles(id, entries)
          return {
            id,
            kind: stored,
            name: input.name,
            expiresAt: expiresAt.toISOString(),
          } satisfies Uploaded
        })

        // Any failure after the put leaves no orphan bytes behind.
        return yield* record.pipe(Effect.tapError(() => storage.delete(key).pipe(Effect.ignore)))
      }).pipe(Effect.withSpan('Artifacts.upload'))
    }

    // Live artifacts only: not deleted, not expired.
    function get(id: string) {
      return db
        .select()
        .from(artifact)
        .where(
          and(eq(artifact.id, id), isNull(artifact.deletedAt), gt(artifact.expiresAt, new Date())),
        )
        .limit(1)
        .pipe(
          Effect.flatMap((rows) =>
            rows[0] ? Effect.succeed(rows[0]) : new NotFound({ message: 'Artifact not found.' }),
          ),
          Effect.withSpan('Artifacts.get'),
        )
    }

    function files(artifactId: string) {
      return db
        .select()
        .from(artifactFile)
        .where(eq(artifactFile.artifactId, artifactId))
        .orderBy(asc(artifactFile.path))
        .pipe(Effect.withSpan('Artifacts.files'))
    }

    function file(artifactId: string, path: string) {
      return db
        .select()
        .from(artifactFile)
        .where(and(eq(artifactFile.artifactId, artifactId), eq(artifactFile.path, path)))
        .limit(1)
        .pipe(Effect.map((rows) => rows[0] ?? null))
    }

    // Newest first, live only. The uploader label resolves the token name.
    function listByProject(projectId: string) {
      return db
        .select({ row: artifact, tokenName: token.name })
        .from(artifact)
        .leftJoin(token, eq(token.id, artifact.uploadedBy))
        .where(
          and(
            eq(artifact.projectId, projectId),
            isNull(artifact.deletedAt),
            gt(artifact.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(artifact.createdAt))
        .pipe(
          Effect.map((rows) =>
            rows.map(({ row, tokenName }): ArtifactSummary => ({
              id: row.id,
              name: row.name,
              kind: row.kind,
              size: row.size,
              uploadedBy: tokenName ?? (row.uploadedBy === 'mcp' ? 'MCP' : 'revoked token'),
              createdAt: row.createdAt.toISOString(),
              expiresAt: row.expiresAt.toISOString(),
            })),
          ),
          Effect.withSpan('Artifacts.listByProject'),
        )
    }

    // Soft delete. The cron removes the bytes.
    function remove(userId: string, id: string) {
      return db
        .update(artifact)
        .set({ deletedAt: new Date() })
        .where(and(eq(artifact.id, id), eq(artifact.userId, userId), isNull(artifact.deletedAt)))
        .returning({ id: artifact.id })
        .pipe(
          Effect.flatMap((rows) =>
            rows.length === 0 ? new NotFound({ message: 'Artifact not found.' }) : Effect.void,
          ),
          Effect.withSpan('Artifacts.remove'),
        )
    }

    return { upload, get, files, file, listByProject, remove }
  }),
}) {}
