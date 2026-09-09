import { defineConfig } from 'drizzle-kit'

// Generate only. Migrations are applied with `wrangler d1 migrations apply`
// from apps/web, which points its migrations_dir at ./migrations.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
})
