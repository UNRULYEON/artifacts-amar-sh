import * as SqliteDrizzle from '@effect/sql-drizzle/Sqlite'
import { schema } from '@artifacts/db'
import { Context, Layer } from 'effect'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

// Drizzle over the Effect SQL client. Every query builder is an Effect:
//   const db = yield* Database
//   const rows = yield* db.select().from(schema.project)
// Failures surface as SqlError. D1 has no interactive transactions; use
// `SqlClient.batch` from @effect/sql-d1 for atomic multi-statement writes.
export class Database extends Context.Tag('@artifacts/api/Database')<
  Database,
  SqliteRemoteDatabase<typeof schema>
>() {
  static readonly layer = Layer.effect(Database, SqliteDrizzle.make({ schema }))
}
