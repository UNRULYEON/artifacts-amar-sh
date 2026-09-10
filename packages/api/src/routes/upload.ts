import { Effect, Schema } from 'effect'
import { BadRequest, LengthRequired, PayloadTooLarge } from '../errors'
import type { Route } from '../http'
import { DEFAULT_TTL_SECONDS, MAX_UPLOAD_BYTES } from '../limits'
import { Artifacts } from '../services/artifacts'
import { Projects } from '../services/projects'
import { SettingsService } from '../services/settings'
import { Tokens } from '../services/tokens'

export const FileName = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(255),
  Schema.pattern(/^[^/\\\0]+$/, { message: () => 'name must be a file name, not a path' }),
)

export const UploadQuery = Schema.Struct({
  project: Schema.Trim.pipe(Schema.minLength(1)),
  name: FileName,
  ttl: Schema.optional(Schema.NumberFromString.pipe(Schema.int(), Schema.positive())),
})

export function contentLength(request: Request) {
  const raw = request.headers.get('content-length')
  if (raw === null) {
    return Effect.fail(new LengthRequired({ message: 'Content-Length is required.' }))
  }
  const size = Number(raw)
  if (!Number.isInteger(size) || size < 0) {
    return Effect.fail(new BadRequest({ message: 'Content-Length is not a number.' }))
  }
  if (size === 0) return Effect.fail(new BadRequest({ message: 'Body is empty.' }))
  if (size > MAX_UPLOAD_BYTES) {
    return Effect.fail(new PayloadTooLarge({ message: `Body exceeds ${MAX_UPLOAD_BYTES} bytes.` }))
  }
  return Effect.succeed(size)
}

export function upload(request: Request): Route {
  return Effect.gen(function* () {
    const tokens = yield* Tokens
    const identity = yield* tokens.requireBearer(request)
    const url = new URL(request.url)
    const query = yield* Schema.decodeUnknown(UploadQuery)(Object.fromEntries(url.searchParams))
    const size = yield* contentLength(request)
    if (!request.body) return yield* new BadRequest({ message: 'Body is empty.' })

    const projects = yield* Projects
    const project = yield* projects.resolve(identity.userId, query.project)
    const settings = yield* SettingsService
    const ttlSeconds =
      query.ttl ??
      project.ttlSeconds ??
      (yield* settings.defaultTtl(identity.userId)) ??
      DEFAULT_TTL_SECONDS
    const artifacts = yield* Artifacts
    const result = yield* artifacts.upload({
      userId: identity.userId,
      projectId: project.id,
      name: query.name,
      size,
      body: request.body,
      ttlSeconds,
      uploadedBy: identity.tokenId,
    })
    return Response.json(
      { id: result.id, url: `${url.origin}/a/${result.id}`, expiresAt: result.expiresAt },
      { status: 201 },
    )
  })
}
