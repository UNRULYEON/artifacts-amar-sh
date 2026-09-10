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

## Auth

GitHub login through Better Auth. Only the GitHub account in `OWNER_GITHUB_ID` can sign up; every other account gets "Sign up is closed."

Worker secrets, set once with `wrangler secret put <NAME>` from `apps/web`:

| Secret                 | What                                                                            |
| ---------------------- | ------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`   | Random string, at least 32 bytes. `openssl rand -base64 32`                     |
| `GITHUB_CLIENT_ID`     | GitHub OAuth app, callback `https://artifacts.amar.sh/api/auth/callback/github` |
| `GITHUB_CLIENT_SECRET` | Same app                                                                        |
| `OWNER_GITHUB_ID`      | Numeric GitHub user id. `gh api user --jq .id`                                  |

Local dev reads the same names from `apps/web/.dev.vars`. Use a second GitHub OAuth app with callback `http://localhost:3000/api/auth/callback/github`, and run the dev server on port 3000 because Better Auth only trusts `APP_URL` as the origin.

Routes: `/api/auth/*` is Better Auth, `GET /api/me` returns the signed-in user or `401`, `/login` and `/` are the UI.

## Projects

Projects live under the signed-in user. The `name` is a slug (`[a-z0-9]` with single dashes, max 64) and is what uploads reference. Deleting a project soft-deletes it and its artifacts; the slug is free again at once.

All routes need the session cookie. Mutations also need an `Origin` header equal to `APP_URL`.

| Route                      | What                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `GET /api/projects`        | List, by name                                                          |
| `POST /api/projects`       | `{ name, displayName?, ttlSeconds? }` → `201` with the project         |
| `PATCH /api/projects/:id`  | Same fields, all optional. `null` clears `displayName` or `ttlSeconds` |
| `DELETE /api/projects/:id` | `204`                                                                  |

`ttlSeconds` is between 60 and 90 days. A duplicate name returns `409`.

## Health

`GET /api/health` returns `200` when the Worker answers. It does not probe D1 or R2.

```json
{ "ok": true, "version": "<git sha>", "time": "..." }
```

Local dev needs no Cloudflare account. Miniflare emulates D1 and R2 under `apps/web/.wrangler/`.
Local vars live in `apps/web/.dev.vars` (copy from `.dev.vars.example`).
