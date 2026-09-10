import { schema } from '@artifacts/db'
import { and, count, eq, gt, isNull, sum } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { NotFound } from '../errors'
import { MAX_TTL_SECONDS, MIN_TTL_SECONDS } from '../limits'
import { Database } from './database'

const { user, artifact } = schema

export const UpdateSettings = Schema.Struct({
  defaultTtlSeconds: Schema.optional(
    Schema.NullOr(Schema.Int.pipe(Schema.between(MIN_TTL_SECONDS, MAX_TTL_SECONDS))),
  ),
})
export type UpdateSettings = typeof UpdateSettings.Type

export interface Settings {
  defaultTtlSeconds: number | null
  usage: { artifacts: number; bytes: number }
}

export class SettingsService extends Effect.Service<SettingsService>()('@artifacts/api/Settings', {
  effect: Effect.gen(function* () {
    const db = yield* Database

    function defaultTtl(userId: string) {
      return db
        .select({ defaultTtlSeconds: user.defaultTtlSeconds })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .pipe(
          Effect.flatMap((rows) =>
            rows[0]
              ? Effect.succeed(rows[0].defaultTtlSeconds)
              : new NotFound({ message: 'User not found.' }),
          ),
        )
    }

    function usage(userId: string) {
      return db
        .select({ artifacts: count(), bytes: sum(artifact.size) })
        .from(artifact)
        .where(
          and(
            eq(artifact.userId, userId),
            isNull(artifact.deletedAt),
            gt(artifact.expiresAt, new Date()),
          ),
        )
        .pipe(
          Effect.map((rows) => ({
            artifacts: rows[0]?.artifacts ?? 0,
            bytes: Number(rows[0]?.bytes ?? 0),
          })),
        )
    }

    function get(userId: string) {
      return Effect.all({ defaultTtlSeconds: defaultTtl(userId), usage: usage(userId) }).pipe(
        Effect.map((s): Settings => s),
        Effect.withSpan('Settings.get'),
      )
    }

    function update(userId: string, patch: UpdateSettings) {
      return Effect.gen(function* () {
        if (patch.defaultTtlSeconds !== undefined) {
          yield* db
            .update(user)
            .set({ defaultTtlSeconds: patch.defaultTtlSeconds })
            .where(eq(user.id, userId))
        }
        return yield* get(userId)
      }).pipe(Effect.withSpan('Settings.update'))
    }

    return { get, update, defaultTtl }
  }),
}) {}
