import { Effect, Schema } from 'effect'
import { BadRequest, LengthRequired, PayloadTooLarge } from '../errors'
import type { Route } from '../http'
import { DEFAULT_TTL_SECONDS, MAX_UPLOAD_BYTES } from '../limits'
import { Artifacts, type Uploaded } from '../services/artifacts'
import { Projects } from '../services/projects'
import { SettingsService } from '../services/settings'
import { Tickets, CreateTicket } from '../services/tickets'
import { Tokens } from '../services/tokens'
import { FileName } from '../services/upload-input'
import { jsonBody } from './helpers'

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

export interface UploadTarget {
  userId: string
  projectId: string
  projectTtlSeconds: number | null
  name: string
  ttlSeconds: number | undefined
  uploadedBy: string
}

// Request, project, user default, then 30 days.
export function resolveTtl(
  target: Pick<UploadTarget, 'userId' | 'projectTtlSeconds' | 'ttlSeconds'>,
) {
  return Effect.gen(function* () {
    if (target.ttlSeconds !== undefined) return target.ttlSeconds
    if (target.projectTtlSeconds !== null) return target.projectTtlSeconds
    const settings = yield* SettingsService
    return (yield* settings.defaultTtl(target.userId)) ?? DEFAULT_TTL_SECONDS
  })
}

export function created(origin: string, result: Uploaded) {
  return Response.json(
    { id: result.id, url: `${origin}/a/${result.id}`, expiresAt: result.expiresAt },
    { status: 201 },
  )
}

function streamUpload(request: Request, target: UploadTarget) {
  return Effect.gen(function* () {
    const size = yield* contentLength(request)
    if (!request.body) return yield* new BadRequest({ message: 'Body is empty.' })
    const ttlSeconds = yield* resolveTtl(target)
    const artifacts = yield* Artifacts
    const result = yield* artifacts.upload({
      userId: target.userId,
      projectId: target.projectId,
      name: target.name,
      size,
      body: request.body,
      ttlSeconds,
      uploadedBy: target.uploadedBy,
    })
    return created(new URL(request.url).origin, result)
  })
}

export function upload(request: Request): Route {
  return Effect.gen(function* () {
    const tokens = yield* Tokens
    const identity = yield* tokens.requireBearer(request)
    const url = new URL(request.url)
    const query = yield* Schema.decodeUnknown(UploadQuery)(Object.fromEntries(url.searchParams))
    const projects = yield* Projects
    const project = yield* projects.resolve(identity.userId, query.project)
    return yield* streamUpload(request, {
      userId: identity.userId,
      projectId: project.id,
      projectTtlSeconds: project.ttlSeconds,
      name: query.name,
      ttlSeconds: query.ttl,
      uploadedBy: identity.tokenId,
    })
  })
}

export function createUploadTicket(request: Request): Route {
  return Effect.gen(function* () {
    const tokens = yield* Tokens
    const identity = yield* tokens.requireBearer(request)
    const input = yield* jsonBody(request, CreateTicket)
    const tickets = yield* Tickets
    const ticket = yield* tickets.create(identity.userId, input, identity.tokenId)
    const url = `${new URL(request.url).origin}/u/${ticket.id}`
    return Response.json(
      {
        url,
        expiresAt: ticket.expiresAt.toISOString(),
        curl: `curl -X PUT --data-binary @${JSON.stringify(ticket.name)} ${JSON.stringify(url)}`,
      },
      { status: 201 },
    )
  })
}

export function uploadWithTicket(request: Request, ticketId: string): Route {
  return Effect.gen(function* () {
    // Cheap checks first so a malformed request does not burn the ticket.
    yield* contentLength(request)
    const tickets = yield* Tickets
    const ticket = yield* tickets.claim(ticketId)
    const projects = yield* Projects
    const project = yield* projects.get(ticket.userId, ticket.projectId)
    return yield* streamUpload(request, {
      userId: ticket.userId,
      projectId: project.id,
      projectTtlSeconds: project.ttlSeconds,
      name: ticket.name,
      ttlSeconds: ticket.ttlSeconds ?? undefined,
      uploadedBy: ticket.createdBy ?? 'ticket',
    })
  })
}
