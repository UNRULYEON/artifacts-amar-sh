import { defineConfig } from 'drizzle-kit'

// Generate only. apps/web applies the SQL with wrangler.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema.ts',
  out: './migrations',
})
