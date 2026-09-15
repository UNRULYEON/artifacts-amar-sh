import { schema } from '@artifacts/db'
import { inArray, isNotNull, lt, or, sql } from 'drizzle-orm'
import { Effect } from 'effect'
import { Database } from './database'
import { Storage } from './storage'

const { artifact, artifactFile, project, uploadTicket } = schema

// 100 ids per statement keeps D1 under its bound parameter limit.
export const SWEEP_BATCH = 100
export const SWEEP_MAX_BATCHES = 20

export interface SweepResult {
  artifacts: number
  batches: number
}

export class Retention extends Effect.Service<Retention>()('@artifacts/api/Retention', {
  effect: Effect.gen(function* () {
    const db = yield* Database
    const storage = yield* Storage

    function nextBatch(now: Date) {
      return db
        .select({ id: artifact.id, r2Key: artifact.r2Key })
        .from(artifact)
        .where(or(lt(artifact.expiresAt, now), isNotNull(artifact.deletedAt)))
        .limit(SWEEP_BATCH)
    }

    // Bytes first, then metadata. A crash between them leaves a row that the
    // next run picks up again; R2 delete of a missing key is a no-op.
    function deleteBatch(rows: { id: string; r2Key: string }[]) {
      const ids = rows.map((r) => r.id)
      return Effect.gen(function* () {
        yield* storage.delete(rows.map((r) => r.r2Key))
        yield* db.delete(artifactFile).where(inArray(artifactFile.artifactId, ids))
        yield* db.delete(artifact).where(inArray(artifact.id, ids))
      })
    }

    function sweep() {
      return Effect.gen(function* () {
        const now = new Date()
        const result: SweepResult = { artifacts: 0, batches: 0 }
        while (result.batches < SWEEP_MAX_BATCHES) {
          const rows = yield* nextBatch(now)
          if (rows.length === 0) break
          yield* deleteBatch(rows)
          result.artifacts += rows.length
          result.batches++
        }
        // Tickets reference projects, so they go first. A ticket on a deleted
        // project can no longer upload.
        yield* db
          .delete(uploadTicket)
          .where(
            or(
              lt(uploadTicket.expiresAt, now),
              sql`${uploadTicket.projectId} in (select ${project.id} from ${project} where ${project.deletedAt} is not null)`,
            ),
          )
        yield* db
          .delete(project)
          .where(
            sql`${project.deletedAt} is not null and not exists (select 1 from ${artifact} where ${artifact.projectId} = ${project.id})`,
          )
        yield* Effect.logInfo('sweep done', result)
        return result
      }).pipe(Effect.withSpan('Retention.sweep'))
    }

    return { sweep }
  }),
}) {}
