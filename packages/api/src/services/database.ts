import * as SqliteDrizzle from '@effect/sql-drizzle/Sqlite'
import { schema } from '@artifacts/db'
import { Context, Layer } from 'effect'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

// Drizzle query builders are Effects here. Failures are SqlError.
export class Database extends Context.Tag('@artifacts/api/Database')<
  Database,
  SqliteRemoteDatabase<typeof schema>
>() {
  static readonly layer = Layer.effect(Database, SqliteDrizzle.make({ schema }))
}
