# Artifacts — Product & Engineering Plan

Host for CI and agent artifacts (screenshots, videos, Playwright-style HTML reports). The owner logs in, clients upload via API or MCP, and they get a URL back. Opening that URL requires a logged-in session.

**Domain:** `https://artifacts.amar.sh`
**Stack:** Cloudflare only (Worker on the **Workers Paid** plan, D1, R2, Cron). R2 is private; every read and write goes through the Worker.
**Code:** Bun + Turborepo monorepo. `apps/web` is the single Worker (TanStack Start UI, Hono as the outer router). `packages/api` is the Hono app; all backend logic is **Effect** (services as tags and layers, `Schema` for validation, typed errors, one `ManagedRuntime` per Worker env, `@effect/sql-d1` + `@effect/sql-drizzle` for D1). `packages/db` is the Drizzle schema and migrations.

---

## Goals

- Simple upload: API call (or MCP tool) → store in R2 → return a viewer URL.
- A logged-in user can open that URL and see the artifact.
- The owner manages projects, tokens, and retention.
- GitHub Actions / runners use named API tokens.
- Agents connect over MCP with OAuth once and can upload to all projects.

## Non-goals (v1)

- Organizations, roles, invites, membership ACLs
- More than one human account (signup is owner-only, see Auth)
- Per-project tokens or clients as a first-class concept
- Search, grouping by PR/commit, compare, pin, favorites
- Public no-login share links
- Direct R2 / presigned bucket URLs
- Unpacking zips into many R2 objects (zips stay as one object, see Upload)
- Billing, quotas as a product, webhooks, GitHub PR bots
- Multiple login providers

---

## Product model

- **User-based.** No orgs. No roles. One human account: the owner.
- **Projects** live directly under the user.
- **Viewer access** is a session check only. No project ACL. The URL is unguessable (≥ 128 bits of randomness in the id).
- **API tokens** and **MCP OAuth** are equivalent in power: they act as the user and can upload to **all** projects.

### Actors

| Actor         | How they auth                          | What they do                                  |
| ------------- | -------------------------------------- | --------------------------------------------- |
| Human (owner) | GitHub via Better Auth, session cookie | Dashboard, settings, open viewer URLs         |
| Runner / CI   | Named user API token (`Bearer`)        | Upload                                        |
| Agent         | MCP OAuth (Better Auth)                | Discover, mint upload URL, upload small files |

---

## Auth

- **Better Auth** on the Worker, data in D1 (`database: env.DB`, no adapter package needed).
- **Login is GitHub only** (Better Auth social provider).
- Session cookie for the dashboard and artifact viewer.
- Unauthenticated request to a viewer URL → GitHub login → redirect back to the artifact.

### Signup (owner only)

- Env var `OWNER_GITHUB_ID` holds the owner's numeric GitHub user id.
- `databaseHooks.user.create.before` rejects any signup whose GitHub account id is not `OWNER_GITHUB_ID`.
- Result: exactly one account can ever exist. Signup is effectively disabled after the owner signs in.
- Because of this, "any logged-in user" equals "the owner". The session gate is still kept as a session check, not an owner check, so nothing changes if a second account is ever allowed later.

### Human session

- HttpOnly, Secure, SameSite=Lax cookie.
- Required to open `/a/:id` (the viewer gate). Artifact bytes themselves are served from a signed prefix and do not need the cookie (see Viewing).
- **CSRF:** every mutating session request (`POST`/`PATCH`/`DELETE` under `/api/`) must carry an `Origin` header equal to `https://artifacts.amar.sh`. Better Auth's own routes use its `trustedOrigins` check.
- **Login return URL:** the `callbackURL` after GitHub login must be a same-origin path (starts with `/`, not `//`). Anything else falls back to `/`.

### API tokens (CI / runners)

- The owner can create **many** named tokens (e.g. `github-ci`, `laptop`).
- **Name only** — no description field.
- Each token can upload to all projects.
- Create → name it → secret shown **once**.
- Format: `art_` + 32 random bytes, base64url. The prefix helps secret scanners.
- Store `sha256(secret)` only. Lookup is by hash. No bcrypt needed; the secret is high entropy.
- List: name, created, last used, revoke.
- Revoke one token without touching the others.
- No expiry in v1.
- `lastUsedAt` is updated on each upload (one D1 write per upload is fine).

### MCP OAuth

- This app is the OAuth server via `@better-auth/mcp` (+ `jwt` plugin). The MCP plugin is built on the OAuth Provider plugin; do **not** also register `oauthProvider()`.
- Resource: `https://artifacts.amar.sh/mcp`. The plugin serves RFC 9728 protected resource metadata and binds tokens to the resource.
- Client registration: **CIMD** (Client ID Metadata Documents) via `@better-auth/cimd` with `metadataProfile: "mcp-2026-07-28"`. The client's `client_id` is the HTTPS URL of its hosted metadata JSON. The Worker fetches and validates it; no registration endpoint, no shared secrets, no junk rows in D1.
- CIMD transport on Workers: the shipped `@better-auth/cimd/node` transport is Node-only. Provide a small `fetchClientMetadataResource`: `fetch(url, { redirect: "manual" })`, require `https:`, reject IP literals and `localhost`, accept only `200`. Workers outbound fetch cannot reach private ranges, so no address pinning is needed.
- `isMetadataDocumentUrlAllowed`: allowlist of the metadata origins for the clients in use (e.g. Cursor, Claude Code). Keep it small; extend when a new client is added.
- Dynamic Client Registration (DCR) stays **off**. Turn on `allowDynamicClientRegistration` only if a needed client cannot send a URL `client_id`.
- MCP client discovers OAuth, the owner signs in with GitHub, consents once.
- After that, the agent can call MCP tools as the owner for all projects.
- CORS: allow `GET`/`POST`/`OPTIONS` on `/mcp` and the `/.well-known/*` OAuth paths for browser-based MCP clients. Native clients do not need it.
- MCP stays on OAuth. A leaked Actions token is "revoke that token," not rotate MCP.

---

## Projects

- Create / rename / delete under the current user.
- `name` is a slug, unique per user. Optional `displayName`. Stable id in the API.
- Upload may reference a project by id or by name. An unknown name **auto-creates** the project (one less manual step for CI).
- Per-project TTL (fallback: user default).
- Deleting a project marks it and its artifacts `deletedAt`; the cron sweeps the bytes (see Retention).

---

## Upload

Single internal function for HTTP, signed upload URLs, and MCP inline uploads.

1. Authenticate (API token, MCP OAuth bearer, or a one-time upload ticket).
2. Client sends the **raw file body** with `Content-Length`. No multipart.
3. Worker streams the body straight to **R2** (`R2.put(key, request.body)` with the known length). Constant memory.
4. If the file is a zip, the Worker reads the zip tail from R2 with a range read, parses the central directory, and writes one `ArtifactFile` row per entry (D1 batch insert).
5. Metadata to **D1**. Response includes a viewer URL: `https://artifacts.amar.sh/a/<id>`.

### Rules

- Max body size **100MB**. This is also the Cloudflare zone plan limit (Free/Pro). Do not raise the cap without a zone plan upgrade.
- `Content-Length` is required. Chunked uploads get `411`.
- R2 is private. No public bucket, no presigned URLs, no client access to the bucket.
- Accept a single file (screenshot, video, log, anything) or a zip. Zips are **stored as one object**, never unpacked into R2.
- `kind` is derived from the file name extension (`png/jpg/webp/gif` → image, `mp4/webm` → video, `zip` → bundle, `html` → page, else → file). Never trust the client `Content-Type`.
- Optional metadata if cheap: commit SHA, PR number. Not required.
- Record which token or MCP client uploaded, for the list view.

### Zip rules

- Only `stored` (method 0) and `deflate` (method 8) entries. Others → `400`.
- No Zip64. Not needed under 100MB. Zips with Zip64 markers → `400`.
- Entry paths are normalized. Reject `..`, absolute paths, backslashes, and anything that escapes the root.
- Report root detection: if every entry shares one top-level folder and it contains `index.html`, that folder is the root. Else the zip root is the root. If no `index.html`, the bundle is a plain file list (download only).
- Store per entry: `path`, `offset` (of the local header), `compressedSize`, `size`, `method`, `crc32`. The local header is re-read on serve to skip it.

### Limits (defaults, tunable)

| Limit                     | Value               |
| ------------------------- | ------------------- |
| Max upload                | 100MB               |
| Max zip entries           | 5000                |
| Default TTL               | 30 days             |
| Max TTL (clamp)           | 90 days             |
| MCP inline upload         | 2MB                 |
| Upload ticket lifetime    | 10 minutes, one use |
| Viewer signature lifetime | 1 hour              |

### Types we actually view

- **Screenshot** — in-browser image + download
- **Video** — in-browser player (range requests) + download
- **HTML report** — served from the zip as a static site (`index.html` + assets)
- Everything else — download original

---

## Viewing

Two layers: an app-origin **gate** and a sandboxed **byte prefix**.

### Gate: `GET /a/:id`

- No session → redirect to GitHub login, then back here.
- Session → mint a signature and:
  - image / video / file → render the HTML shell (viewer chrome, download button) with the media loaded from the signed prefix.
  - bundle with `index.html` → `302` to `/r/:id/<exp>.<sig>/index.html`.

### Bytes: `GET /r/:id/<exp>.<sig>/<path>`

- `sig = HMAC-SHA256(secret, id + "." + exp)`, base64url. Stateless. `exp` is a unix timestamp ≤ 1 hour ahead.
- Valid signature → serve. **No cookie is read on this route.** Expired or bad signature → `403` with a link back to `/a/:id` (which re-signs after a session check).
- Relative asset paths inside a report resolve within the prefix, so Playwright reports work unchanged.
- Single-file artifacts use `<path>` = the file name.
- Bundle entries: one R2 range `get` for the entry bytes, then `DecompressionStream('deflate-raw')` for method 8. No unzip library.

### Response headers on `/r/*`

- `Content-Security-Policy: sandbox allow-scripts` — opaque origin. Report JS cannot read cookies, cannot reach a same-origin dashboard window, cannot call the API. This is what makes same-host hosting safe; a plain `connect-src` CSP does not (a same-origin `window.open` handle bypasses it).
- `X-Content-Type-Options: nosniff`
- `Content-Type` from the extension table. Unknown extension → `application/octet-stream` + `Content-Disposition: attachment`.
- `Cache-Control: private, max-age=300`
- `Accept-Ranges: bytes`; honor `Range` and return `206` (needed for video seeking, and Safari refuses to play without it).

### Why the sandbox is still needed with one user

Uploads come from CI tokens. A compromised dependency or workflow can upload a malicious report. The sandbox keeps that report from acting as the owner in the browser.

---

## Dashboard

Keep it small.

- Login (GitHub).
- Home: list of projects.
- Project: **flat list of artifacts, newest upload first**.
- Artifact row: name, type, size, upload time, which token/MCP uploaded (if known), TTL remaining, viewer link, delete.
- Settings: GitHub identity, **token list** (create / revoke), default TTL.
- Dashboard pages send their own strict CSP (`default-src 'self'`, no inline scripts).
- No search, grouping, compare, pins, or activity feed in v1.

---

## Retention

- User default TTL; projects can override.
- Optional TTL on the upload request (clamped to the max).
- Manual delete from the dashboard sets `deletedAt`. The row disappears from lists at once; bytes go on the next sweep.
- Cron Trigger (every 15 minutes):
  1. Select artifacts where `expiresAt < now` or `deletedAt` is set, limit 200.
  2. Delete R2 objects by key (`R2.delete([...keys])`, ≤ 1000 keys per call). Keys come from D1; no prefix listing is needed.
  3. Delete `ArtifactFile` rows, then the `Artifact` row.
  4. Repeat until empty or near the CPU budget.
- Index `Artifact(expiresAt)` and `Artifact(deletedAt)`.
- No pin / keep-forever / bulk-cleanup UI in v1.

---

## Usage (lightweight)

- For the user: stored bytes, artifact count.
- Per project if it is cheap.
- Which token vs MCP, if it is cheap.
- No billing. No hard quota UI. 100MB per upload is the safety cap.

---

## Architecture

All traffic: **client → `artifacts.amar.sh` → Worker → D1 / R2**.

| Piece         | Role                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| Worker (Paid) | HTTP API, Better Auth, MCP, viewer gate, signed byte prefix, R2 I/O, UI                      |
| D1            | users, sessions, OAuth, token hashes, projects, artifact metadata, zip index, upload tickets |
| R2            | artifact bytes (private), one object per artifact                                            |
| Cron Trigger  | expiry cleanup                                                                               |
| Custom domain | `artifacts.amar.sh`                                                                          |

UI is served from the same Worker (Workers Static Assets). No second Pages app required.

### Data (logical)

- **User** — Better Auth user linked to GitHub. Only one row can exist.
- **Token** — `id`, `userId`, `name`, `hash`, `createdAt`, `lastUsedAt`.
- **Project** — `id`, `userId`, `name` (slug, unique per user), `displayName`, `ttlSeconds`, `createdAt`, `deletedAt`.
- **Artifact** — `id` (`art_` + 16 random bytes base64url), `userId`, `projectId`, `name`, `kind`, `size`, `r2Key`, `rootPath` (bundle root, may be empty), `uploadedBy` (token id or `mcp`), `createdAt`, `expiresAt`, `deletedAt`.
- **ArtifactFile** (zip index) — `artifactId`, `path`, `offset`, `compressedSize`, `size`, `method`, `crc32`. Unique on `(artifactId, path)`.
- **UploadTicket** — `id`, `userId`, `projectId`, `name`, `ttlSeconds`, `expiresAt`, `usedAt`.

### Object keys

`users/<userId>/projects/<projectId>/artifacts/<artifactId>` — one object per artifact.

---

## HTTP API (v1)

Base: `https://artifacts.amar.sh`

Auth:

- Session cookie — dashboard JSON + `GET /a/:id`
- `Authorization: Bearer <token>` — upload and any machine API
- MCP OAuth bearer — MCP routes (and the same upload implementation internally)
- Upload ticket — `PUT /u/:ticket` only

### Upload

```
POST /api/upload?project=<id|name>&name=<filename>&ttl=<seconds>
Authorization: Bearer <token>
Content-Length: <bytes>            (required, ≤ 100MB)
Content-Type: application/octet-stream

<raw file body>
```

- `project` — required. Unknown name auto-creates the project.
- `name` — required. Used for `kind` and for the file name on download.
- `ttl` — optional seconds, clamped to the max.
- Optional: `commit`, `pr` query params.

Example:

```
curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" \
  --data-binary @playwright-report.zip \
  "https://artifacts.amar.sh/api/upload?project=web&name=playwright-report.zip"
```

**201:**

```json
{
  "id": "art_...",
  "url": "https://artifacts.amar.sh/a/art_...",
  "expiresAt": "2026-09-16T12:00:00.000Z"
}
```

### Upload tickets (for agents)

```
POST /api/upload-tickets            Bearer (token or MCP OAuth)
{ "project": "web", "name": "screen.png", "ttl": 86400 }
→ 201 { "url": "https://artifacts.amar.sh/u/<ticket>", "expiresAt": "..." }

PUT /u/:ticket                      no auth header; the ticket is the auth
<raw body>, Content-Length required
→ 201 same body as POST /api/upload
```

- One use. Ten minute lifetime. Bound to user, project, and name.
- Same 100MB cap and the same internal upload function.

### Viewer

```
GET /a/:id                          session gate → shell or 302 to /r/...
GET /r/:id/<exp>.<sig>/<path>       signed bytes, sandboxed, no cookie
```

### Dashboard JSON (session + Origin check)

- `GET /api/projects`
- `POST /api/projects` `{ "name": "..." }`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:id/artifacts` — newest first
- `DELETE /api/artifacts/:id`
- `GET /api/tokens`
- `POST /api/tokens` `{ "name": "github-ci" }` → `{ "id", "name", "token" }` (token once)
- `DELETE /api/tokens/:id`

Better Auth mounts under `/api/auth/*` (GitHub OAuth, session, MCP OAuth discovery).

---

## MCP

Same Worker, same domain.

- **Resource / MCP endpoint:** `https://artifacts.amar.sh/mcp`
- OAuth discovery at the well-known paths Better Auth serves.
- Streamable HTTP MCP, stateless, `POST` only (`GET` → `405`), wrapped in Better Auth MCP auth.

### Tools

1. **`discover`**
   How to upload, size limits, that tokens/MCP see all projects, the project list (id, name), and the `curl` shape for `PUT /u/:ticket`.

2. **`get_upload_url`**
   Args: `project`, `name`, optional `ttl`. Creates an upload ticket. Returns the `PUT` URL and a ready `curl` command. The agent runs it in its shell. This is the path for anything above the inline cap.

3. **`upload`**
   Args: `project`, `name`, `contentBase64`, optional `ttl`. Inline upload for small files (≤ 2MB, screenshots). Returns the viewer URL.

Why: MCP tool arguments are JSON, and the Worker cannot read the agent's disk. Large files cannot travel inside a tool call. The ticket URL keeps "Worker in, Worker out" and no presigned R2.

---

## Security

- R2 not publicly reachable; only the Worker binding.
- Exactly one account. `OWNER_GITHUB_ID` gate on signup.
- Token secrets hashed at rest; shown once; `art_` prefix.
- Viewer URLs are app URLs, not bucket URLs.
- Session required at the gate. Bytes are served under a short-lived signed prefix with `CSP: sandbox allow-scripts` and `nosniff`. Report JS runs in an opaque origin and cannot touch cookies, the dashboard, or the API.
- Single `.html` and `.svg` uploads go through the same sandboxed prefix. Never serve user bytes from the app origin without the sandbox.
- Mutations require a bearer token, an upload ticket, or session + `Origin` check.
- Login `callbackURL` is validated as a same-origin path.
- Zip entries are path-checked (no zip slip). Zip64 and unusual methods are rejected.
- Cleanup cron deletes both D1 metadata and R2 objects, by known key.

---

## Cloudflare specifics

- **Workers Paid**: 30s CPU per request, 1000 subrequests, 128MB memory. Body limit is 100MB from the zone plan.
- Instantiate Better Auth **per request** with the Drizzle adapter over the D1 binding (`drizzleAdapter(createDb(env.DB), { provider: "sqlite" })`). D1 has no interactive transactions; Better Auth uses batching.
- Migrations: one system. `npx @better-auth/cli generate` writes the auth tables into the Drizzle schema in `packages/db`; `drizzle-kit generate` produces SQL; `wrangler d1 migrations apply` runs it. No `getMigrations()` route.
- GitHub OAuth callback: `https://artifacts.amar.sh/api/auth/callback/github`.
- MCP OAuth issuer/resource all on `https://artifacts.amar.sh`.
- CIMD: custom `fetchClientMetadataResource` (see MCP OAuth). `metadataRevalidationInterval` default 60m is fine; the plugin cache is per isolate, so a cold isolate refetches once.
- Uploads: `R2.put(key, request.body, { httpMetadata })` with a known `Content-Length`. Never `request.formData()` or `arrayBuffer()` on uploads.
- Zip index: range `get` the last 64KB + 22 bytes for the EOCD, then the central directory. Parse by hand (~100 lines). Inflate on read with `DecompressionStream('deflate-raw')`.
- Signing secret and `OWNER_GITHUB_ID` live in Worker secrets.
- Cron: `*/15 * * * *`, delete by key in batches.

---

## UX sketch

**Settings → tokens**

- List of names + created + last used + revoke
- "New token" → ask for a name → show secret once with copy

**Project page**

- Newest-first table
- Click name → viewer (same origin)
- Copy URL, delete

**Viewer**

- Image / video / HTML report
- Download original
- If logged out, GitHub login and return
- If the signed link expired, one click back through `/a/:id` re-signs it

---

## MVP slice

1. Better Auth + GitHub login + owner-only signup + session
2. Projects under the user (slug, auto-create on upload)
3. Multiple named API tokens (create, show once, revoke)
4. `POST /api/upload` raw body ≤ 100MB → stream to R2 → zip index in D1 → viewer URL
5. `GET /a/:id` gate + `GET /r/:id/<exp>.<sig>/*` sandboxed bytes; image / video (ranges) / HTML report from zip
6. Dashboard: projects + newest-first artifact list
7. TTL + cron delete by key
8. Upload tickets: `POST /api/upload-tickets` + `PUT /u/:ticket`
9. MCP: OAuth + CIMD (Workers transport + allowlist) + `discover` + `get_upload_url` + `upload` (inline)

---

## Locked decisions

| Topic                   | Decision                                                            |
| ----------------------- | ------------------------------------------------------------------- |
| Tenancy                 | User only, no org                                                   |
| Accounts                | One. Signup gated on `OWNER_GITHUB_ID`                              |
| Roles / invites         | None                                                                |
| Viewer ACL              | Session exists at the gate; signed prefix for bytes                 |
| Domain                  | `artifacts.amar.sh`, everything on this host                        |
| Storage                 | Worker in, Worker out; private R2; no presign                       |
| Zips                    | Stored as one object; indexed in D1; served by range read + inflate |
| Upload body             | Raw body + `Content-Length`; no multipart                           |
| Login                   | Better Auth, GitHub only                                            |
| CI auth                 | Many named user-level API tokens                                    |
| Token fields            | Name only                                                           |
| MCP auth                | OAuth via `@better-auth/mcp`; all projects                          |
| MCP client registration | CIMD with an origin allowlist; DCR off                              |
| MCP large files         | Upload ticket URL, agent uses curl                                  |
| List UI                 | Flat, newest upload first                                           |
| Upload cap              | 100MB through the Worker (zone plan limit)                          |
| HTML reports            | Same host, signed prefix, `CSP: sandbox allow-scripts`              |
| Plan                    | Workers Paid                                                        |

---

## Follow-ups (not v1)

- Token expiry
- Hard storage quota
- Public unauthenticated links (explicit opt-in)
- Local CLI / stdio MCP that wraps the HTTP API with an API token
- GitHub Action package
- Playwright reporter
- MCP `list` / `get` tools so an agent can read back what it uploaded
- Search, PR grouping, screenshot compare
- Second account (drop the `OWNER_GITHUB_ID` gate for an allowlist)
