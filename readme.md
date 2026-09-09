# artifacts.amar.sh

Host for CI and agent artifacts. See `plan.md` for the product plan and `AGENTS.md` for the working rules.

## Layout

| Path           | What                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web`     | The single Cloudflare Worker. TanStack Start UI, Hono as the outer router, `wrangler.jsonc` with D1 / R2 / cron bindings.                        |
| `packages/api` | Hono for routing, Effect for everything behind it. Services in `src/services`, routes in `src/routes`, the HTTP error boundary in `src/http.ts`. |
| `packages/db`  | Drizzle schema and generated SQL migrations.                                                                                                     |

## Commands

```sh
bun install
bun run dev                # vite dev on :3000 (falls back to another port if busy)
bun run typecheck
bun run test               # bun test in packages/api
bun run lint               # oxlint
bun run format             # oxfmt --check; `format:write` fixes
bun run build
bun run deploy

bun run db:generate        # drizzle-kit generate  -> packages/db/migrations
bun run db:migrate:local   # wrangler d1 migrations apply --local
bun run db:migrate         # wrangler d1 migrations apply --remote
bun run types              # wrangler types -> apps/web/worker-configuration.d.ts
```

## First-time Cloudflare setup

```sh
cd apps/web
bunx wrangler login
bunx wrangler d1 create artifacts      # paste the id into wrangler.jsonc database_id
bunx wrangler r2 bucket create artifacts
```

Both exist already for this repo. The D1 id in `wrangler.jsonc` is the real one.

## CI and CD

Two workflows in `.github/workflows`:

- `ci.yml` runs on pull requests and is reusable. One job installs and caches `node_modules`; a matrix then runs `build`, `test`, `typecheck`, `lint`, and `format` in parallel.
- `cd.yml` runs on pushes to `main`. It calls `ci.yml`, then builds, applies D1 migrations, deploys the Worker with `GIT_SHA` set to the commit, and polls `/api/health` until that version answers. Deploys never overlap. A manual run (`workflow_dispatch`) needs a reason and can skip the checks for an emergency.

Both skip runs that only touch Markdown or `.claude/`.

Secrets, on the repo or on the `production` environment:

| Secret                  | What                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | API token with Workers Scripts, D1, and R2 edit rights on the account, plus Zone read on `amar.sh` for the custom domain. |
| `CLOUDFLARE_ACCOUNT_ID` | The account id from the Cloudflare dashboard.                                                                             |

## Health

`GET /api/health` probes D1 and R2 and returns `200` or `503`:

```json
{
  "ok": true,
  "version": "<git sha>",
  "time": "...",
  "checks": { "d1": { "ok": true, "ms": 3 }, "r2": { "ok": true, "ms": 5 } }
}
```

Local dev needs no Cloudflare account. Miniflare emulates D1 and R2 under `apps/web/.wrangler/`.
Local vars live in `apps/web/.dev.vars` (copy from `.dev.vars.example`).
