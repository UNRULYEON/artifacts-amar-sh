import { schema } from '@artifacts/db'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { Effect, Schema } from 'effect'
import { Conflict, NotFound } from '../errors'
import { newId } from '../id'
import { Database } from './database'

export const MAX_TTL_SECONDS = 90 * 24 * 60 * 60

export const Slug = Schema.String.pipe(
  Schema.maxLength(64),
  Schema.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: () => 'name must be lowercase letters, digits, and single dashes',
  }),
)

export const DisplayName = Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(100))

export const TtlSeconds = Schema.Int.pipe(Schema.between(60, MAX_TTL_SECONDS))

export const CreateProject = Schema.Struct({
  name: Slug,
  displayName: Schema.optional(Schema.NullOr(DisplayName)),
  ttlSeconds: Schema.optional(Schema.NullOr(TtlSeconds)),
})
export type CreateProject = typeof CreateProject.Type

export const UpdateProject = Schema.Struct({
  name: Schema.optional(Slug),
  displayName: Schema.optional(Schema.NullOr(DisplayName)),
  ttlSeconds: Schema.optional(Schema.NullOr(TtlSeconds)),
})
export type UpdateProject = typeof UpdateProject.Type

export interface Project {
  id: string
  name: string
  displayName: string | null
  ttlSeconds: number | null
  createdAt: string
}

const { project, artifact } = schema

type Row = typeof project.$inferSelect

export function toProject(row: Row): Project {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    ttlSeconds: row.ttlSeconds,
    createdAt: row.createdAt.toISOString(),
  }
}

export class Projects extends Effect.Service<Projects>()('@artifacts/api/Projects', {
  effect: Effect.gen(function* () {
    const db = yield* Database

    function live(userId: string) {
      return and(eq(project.userId, userId), isNull(project.deletedAt))
    }

    function list(userId: string) {
      return db
        .select()
        .from(project)
        .where(live(userId))
        .orderBy(asc(project.name))
        .pipe(
          Effect.map((rows) => rows.map(toProject)),
          Effect.withSpan('Projects.list'),
        )
    }

    function find(userId: string, id: string) {
      return db
        .select()
        .from(project)
        .where(and(live(userId), eq(project.id, id)))
        .limit(1)
        .pipe(Effect.map((rows) => rows[0] ?? null))
    }

    function findByName(userId: string, name: string) {
      return db
        .select()
        .from(project)
        .where(and(live(userId), eq(project.name, name)))
        .limit(1)
        .pipe(Effect.map((rows) => rows[0] ?? null))
    }

    function get(userId: string, id: string) {
      return Effect.flatMap(find(userId, id), (row) =>
        row ? Effect.succeed(row) : new NotFound({ message: 'Project not found.' }),
      )
    }

    function assertNameFree(userId: string, name: string) {
      return Effect.flatMap(findByName(userId, name), (row) =>
        row ? new Conflict({ message: `Project "${name}" already exists.` }) : Effect.void,
      )
    }

    function create(userId: string, input: CreateProject) {
      return Effect.gen(function* () {
        yield* assertNameFree(userId, input.name)
        const rows = yield* db
          .insert(project)
          .values({
            id: newId('prj'),
            userId,
            name: input.name,
            displayName: input.displayName ?? null,
            ttlSeconds: input.ttlSeconds ?? null,
            createdAt: new Date(),
          })
          .returning()
        return toProject(rows[0]!)
      }).pipe(Effect.withSpan('Projects.create'))
    }

    function update(userId: string, id: string, patch: UpdateProject) {
      return Effect.gen(function* () {
        const current = yield* get(userId, id)
        if (patch.name !== undefined && patch.name !== current.name) {
          yield* assertNameFree(userId, patch.name)
        }
        const rows = yield* db
          .update(project)
          .set({
            name: patch.name ?? current.name,
            displayName: patch.displayName === undefined ? current.displayName : patch.displayName,
            ttlSeconds: patch.ttlSeconds === undefined ? current.ttlSeconds : patch.ttlSeconds,
          })
          .where(eq(project.id, id))
          .returning()
        return toProject(rows[0]!)
      }).pipe(Effect.withSpan('Projects.update'))
    }

    function remove(userId: string, id: string) {
      return Effect.gen(function* () {
        yield* get(userId, id)
        const now = new Date()
        yield* db.update(project).set({ deletedAt: now }).where(eq(project.id, id))
        yield* db
          .update(artifact)
          .set({ deletedAt: now })
          .where(and(eq(artifact.projectId, id), isNull(artifact.deletedAt)))
      }).pipe(Effect.withSpan('Projects.remove'))
    }

    return { list, get, findByName, create, update, remove }
  }),
}) {}
