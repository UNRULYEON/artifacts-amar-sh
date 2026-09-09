import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema'

export * from './auth-schema'

function timestamp(name: string) {
  return integer(name, { mode: 'timestamp_ms' })
}

export const project = sqliteTable(
  'project',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    displayName: text('display_name'),
    ttlSeconds: integer('ttl_seconds'),
    createdAt: timestamp('created_at').notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [unique('project_user_name').on(t.userId, t.name)],
)

export const token = sqliteTable('token', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  hash: text('hash').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  lastUsedAt: timestamp('last_used_at'),
})

export const artifact = sqliteTable(
  'artifact',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['image', 'video', 'bundle', 'page', 'file'] }).notNull(),
    size: integer('size').notNull(),
    r2Key: text('r2_key').notNull(),
    rootPath: text('root_path').notNull().default(''),
    uploadedBy: text('uploaded_by').notNull(),
    createdAt: timestamp('created_at').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('artifact_project_created').on(t.projectId, t.createdAt),
    index('artifact_expires').on(t.expiresAt),
    index('artifact_deleted').on(t.deletedAt),
  ],
)

export const artifactFile = sqliteTable(
  'artifact_file',
  {
    artifactId: text('artifact_id')
      .notNull()
      .references(() => artifact.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    offset: integer('offset').notNull(),
    compressedSize: integer('compressed_size').notNull(),
    size: integer('size').notNull(),
    method: integer('method').notNull(),
    crc32: integer('crc32').notNull(),
  },
  (t) => [primaryKey({ columns: [t.artifactId, t.path] })],
)

export const uploadTicket = sqliteTable('upload_ticket', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  projectId: text('project_id')
    .notNull()
    .references(() => project.id),
  name: text('name').notNull(),
  ttlSeconds: integer('ttl_seconds'),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
})
