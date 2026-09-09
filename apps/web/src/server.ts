import handler from '@tanstack/react-start/server-entry'
import { createApi } from '@artifacts/api'

// Hono is the outer router. Anything it does not know falls through to
// TanStack Start for SSR pages and server functions.
const api = createApi()
api.notFound((c) => handler.fetch(c.req.raw))

export default {
  fetch: (request, env, ctx) => api.fetch(request, env, ctx),
  scheduled: async (_controller, _env, _ctx) => {
    // Retention sweep lands here (plan: Retention).
  },
} satisfies ExportedHandler<Env>
