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

## Web app

The site installs as a web app (iPhone and iPad "Add to Home Screen", macOS Safari "Add to Dock"). `apps/web/public` holds the manifest and icons. `public/icon.svg` is the only artwork; `bun run --filter web icons` renders every icon PNG and the iOS startup images in `public/splash` from it (macOS only, uses `qlmanage` and `sips`). Commit the PNGs. The device list for startup images lives in `src/lib/ios-devices.ts`; after you change the artwork, bump `splashVersion` there, because iOS caches the images per home-screen entry.

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

All routes need the session cookie. Mutations also need an `Origin` header that matches the origin of the request URL, which a browser sends by itself.

| Route                      | What                                                                   |
| -------------------------- | ---------------------------------------------------------------------- |
| `GET /api/projects`        | List, by name                                                          |
| `POST /api/projects`       | `{ name, displayName?, ttlSeconds? }` → `201` with the project         |
| `PATCH /api/projects/:id`  | Same fields, all optional. `null` clears `displayName` or `ttlSeconds` |
| `DELETE /api/projects/:id` | `204`                                                                  |

`ttlSeconds` is between 60 and 90 days. A duplicate name returns `409`.

Artifacts hang off a project. `/projects/:id` in the UI lists them newest first with a viewer link, copy link, and delete.

| Route                             | What                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `GET /api/projects/:id/artifacts` | Newest first, live only, with the uploader's token name |
| `DELETE /api/artifacts/:id`       | Soft delete, `204`. The cron removes the bytes          |

## API tokens

Named tokens for CI and runners. Manage them on `/settings`. The secret is `art_` plus 32 random bytes, shown once; only its SHA-256 is stored. Every token acts as the user and can upload to every project.

| Route                    | What                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `GET /api/tokens`        | List: `id`, `name`, `createdAt`, `lastUsedAt`              |
| `POST /api/tokens`       | `{ name }` → `201` with the same fields plus `token`, once |
| `DELETE /api/tokens/:id` | Revoke, `204`                                              |

Machine routes read `Authorization: Bearer <token>` and update `lastUsedAt` on each use.

## Upload

```
POST /api/upload?project=<id|name>&name=<file name>&ttl=<seconds>
Authorization: Bearer art_...
Content-Length: <bytes>
```

The raw file is the body. No multipart. The Worker streams it to R2, then writes the metadata to D1 and answers `201` with `{ id, url, expiresAt }`. The `url` is the viewer link on the same host.

- `project` is a project id or a slug. An unknown slug creates the project.
- `name` sets the `kind` (`png/jpg/webp/gif` image, `mp4/webm` video, `zip` bundle, `html` page, else file) and the download name.
- `ttl` is optional and clamped to the range 60 seconds to 90 days. Without it the project TTL, then the 30 day default, applies.
- No `Content-Length` is `411`. Over 100MB is `413`. A body that does not match the length is `400` and the bytes are dropped.

### Upload tickets

For agents and anything that cannot hold a token. Mint a ticket with a token, then `PUT` the file to the ticket URL with no auth header.

```
POST /api/upload-tickets            Authorization: Bearer art_...
{ "project": "web", "name": "shot.png", "ttl": 86400 }
→ 201 { "url": "https://artifacts.amar.sh/u/tkt_...", "expiresAt": "...", "curl": "curl -X PUT ..." }

PUT /u/:ticket                      raw body, Content-Length required
→ 201 { "id", "url", "expiresAt" }  same as POST /api/upload
```

A ticket lives ten minutes, works once, and is bound to the project, the file name, and the token that minted it, which becomes the artifact's uploader. The ticket is claimed before the bytes are read, so an upload that fails after the length check needs a new ticket. A used, expired, or unknown ticket answers `404`.

Zips stay one R2 object. The Worker range-reads the central directory and stores one `artifact_file` row per entry. Rules: stored or deflate only, no Zip64, no encryption, at most 5000 entries, paths that stay inside the root. A folder that holds every entry and an `index.html` becomes `rootPath`. A zip that breaks a rule is `400` and nothing is kept.

```sh
curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" \
  --data-binary @playwright-report.zip \
  "https://artifacts.amar.sh/api/upload?project=web&name=playwright-report.zip"
```

## Viewer

Two layers. `GET /a/:id` is the gate: it needs the session cookie, else it sends you to `/login?redirect=/a/:id` and back. With a session it signs a one hour link and renders the viewer (image, video, single page in a sandboxed iframe, or a file list for a bundle without `index.html`). A bundle with `index.html` redirects straight to it.

`GET /r/:id/<exp>.<sig>/<path>` serves the bytes. No cookie is read. `sig` is an HMAC over `id.exp` with a key derived from `BETTER_AUTH_SECRET`, so there is no second secret to set. An expired or bad link answers `403` with a link back to `/a/:id`, which re-signs it.

Every `/r/*` response carries `Content-Security-Policy: sandbox allow-scripts` and `nosniff`, so report scripts run in an opaque origin and cannot reach cookies, the dashboard, or the API. `Range` requests get `206` on single files and on stored zip entries. Deflated entries are inflated with `DecompressionStream` on the fly. Paths inside a bundle are relative to `rootPath`. Add `?download` for an attachment disposition.

## Retention and settings

Every upload gets `expiresAt` from the request `ttl`, else the project TTL, else the user default, else 30 days, clamped to 60 seconds to 90 days. Deleting from the dashboard only sets `deletedAt`.

The cron (`*/15 * * * *`, see `wrangler.jsonc`) runs `sweep`: it picks artifacts that are expired or soft-deleted in batches of 100, deletes the R2 objects by key, then the `artifact_file` rows, then the `artifact` rows, up to 20 batches per run. It also drops soft-deleted projects that have no artifacts left and expired upload tickets. The run is logged as `sweep done` with counts. A failure is logged and never thrown.

Locally, trigger it with the dev server running:

```sh
curl "http://localhost:3000/cdn-cgi/handler/scheduled?cron=*/15+*+*+*+*"
```

`/settings` shows usage (live artifact count and bytes) and the default retention. `GET /api/settings` returns `{ defaultTtlSeconds, usage }`; `PATCH /api/settings` takes `{ defaultTtlSeconds }`, `null` to reset.

## MCP

Agents connect to `https://artifacts.amar.sh/mcp` (streamable HTTP, `POST` only) and sign in once with OAuth. This app is the OAuth server: Better Auth with the `jwt`, `mcp`, and `cimd` plugins. Nothing to configure in a client beyond the URL.

- Discovery: `/.well-known/oauth-protected-resource/mcp` names the authorization server `https://artifacts.amar.sh/api/auth`, whose metadata lives at `/.well-known/oauth-authorization-server/api/auth`. JWKS is `/api/auth/jwks`.
- Client registration is CIMD only: the client's `client_id` is the HTTPS URL of its metadata document. Dynamic Client Registration stays off. `MCP_CLIENT_ORIGINS` (optional var, comma-separated origins) restricts which metadata hosts may register; unset allows any HTTPS document.
- Flow: the client is sent to `/login`, GitHub signs you in, `/consent` asks once, and the client gets a token bound to the `/mcp` resource. Tokens act as you across every project.
- Tools: `discover` (how it works, limits, projects), `get_upload_url` (a ten minute one-use `PUT` URL plus a ready `curl`, for files up to 100MB), and `upload` (inline base64, up to 2MB). Uploads from MCP show as `MCP` in the dashboard.
- CORS is open on `/mcp`, `/.well-known/*`, `/api/auth/oauth2/*`, and `/api/auth/jwks` for browser-based clients.

Claude Code:

```sh
claude mcp add --transport http artifacts https://artifacts.amar.sh/mcp
```

Schema: the plugin tables in `packages/db/src/auth-schema.ts` come from `bun run generate:auth` (in `packages/db`), which calls the Better Auth generator directly because the CLI's plugin init needs a live database. The four core tables are kept by hand so their SQL defaults survive.

## Health

`GET /api/health` returns `200` when the Worker answers. It does not probe D1 or R2.

```json
{ "ok": true, "version": "<git sha>", "time": "..." }
```

Local dev needs no Cloudflare account. Miniflare emulates D1 and R2 under `apps/web/.wrangler/`.
Local vars live in `apps/web/.dev.vars` (copy from `.dev.vars.example`).
