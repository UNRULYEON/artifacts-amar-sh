import { schema } from '@artifacts/db'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { NotFound } from '../errors'
import { newId } from '../id'
import { Database } from './database'
import { Projects } from './projects'
import { FileName } from './upload-input'

export const TICKET_TTL_SECONDS = 10 * 60

export const CreateTicket = Schema.Struct({
  project: Schema.Trim.pipe(Schema.minLength(1)),
  name: FileName,
  ttl: Schema.optional(Schema.Int.pipe(Schema.positive())),
})
export type CreateTicket = typeof CreateTicket.Type

const { uploadTicket } = schema

export type TicketRow = typeof uploadTicket.$inferSelect

export class Tickets extends Effect.Service<Tickets>()('@artifacts/api/Tickets', {
  effect: Effect.gen(function* () {
    const db = yield* Database
    const projects = yield* Projects

    // The id is the secret: 32 random bytes, ten minutes, one use.
    function create(userId: string, input: CreateTicket, createdBy: string) {
      return Effect.gen(function* () {
        const project = yield* projects.resolve(userId, input.project)
        const rows = yield* db
          .insert(uploadTicket)
          .values({
            id: newId('tkt', 32),
            userId,
            projectId: project.id,
            name: input.name,
            ttlSeconds: input.ttl ?? null,
            createdBy,
            expiresAt: new Date(Date.now() + TICKET_TTL_SECONDS * 1000),
          })
          .returning()
        return rows[0]!
      }).pipe(Effect.withSpan('Tickets.create'))
    }

    // Marks the ticket used in the same statement that finds it, so a second
    // PUT with the same id loses the race.
    function claim(id: string) {
      return db
        .update(uploadTicket)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(uploadTicket.id, id),
            isNull(uploadTicket.usedAt),
            gt(uploadTicket.expiresAt, new Date()),
          ),
        )
        .returning()
        .pipe(
          Effect.flatMap((rows) =>
            rows[0]
              ? Effect.succeed(rows[0])
              : new NotFound({ message: 'Upload ticket not found, used, or expired.' }),
          ),
          Effect.withSpan('Tickets.claim'),
        )
    }

    return { create, claim }
  }),
}) {}
