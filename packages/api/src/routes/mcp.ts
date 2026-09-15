import { createMcpProtectedRequestHandler } from '@better-auth/mcp'
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/server/validators/cf-worker'
import { Cause, Effect } from 'effect'
import * as z from 'zod'
import type { ApiEnv } from '../env'
import { BadRequest } from '../errors'
import { guide, instructions, toolDescriptions, usage } from '../guide'
import { MCP_INLINE_MAX_BYTES } from '../limits'
import { getRuntime, type AppRuntime, type AppServices } from '../runtime'
import { Artifacts } from '../services/artifacts'
import { Auth, mcpResource } from '../services/auth'
import { Projects } from '../services/projects'
import { Tickets } from '../services/tickets'
import { fromBase64url } from '../encoding'
import { buildStoredZip } from '../zip'
import { resolveTtl, uploadResult } from './upload'

// Stateless streamable HTTP MCP. One server per request, bound to the user
// from the access token. Tools act as that user across all projects.

const validator = new CfWorkerJsonSchemaValidator()

function text(value: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] }
}

function failure(message: string): CallToolResult {
  return { content: [{ type: 'text', text: message }], isError: true }
}

function runTool<A>(runtime: AppRuntime, effect: Effect.Effect<A, unknown, AppServices>) {
  return runtime.runPromise(
    effect.pipe(
      Effect.map(text),
      Effect.catchAll((e) =>
        Effect.succeed(
          failure(
            typeof e === 'object' && e && 'message' in e
              ? String(e.message)
              : 'Something went wrong.',
          ),
        ),
      ),
      Effect.catchAllCause((cause) =>
        Effect.logError('mcp tool crashed', Cause.pretty(cause)).pipe(
          Effect.as(failure('Internal error.')),
        ),
      ),
    ),
  )
}

function decodeBase64(value: string, field = 'contentBase64') {
  const compact = value.replace(/\s+/g, '')
  const bytes = fromBase64url(compact.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''))
  return bytes
    ? Effect.succeed(bytes)
    : Effect.fail(new BadRequest({ message: `${field} is not base64.` }))
}

// One inline file: decoded and within the inline limit.
function inlineFile(value: string, field: string) {
  return Effect.gen(function* () {
    const bytes = yield* decodeBase64(value, field)
    if (bytes.byteLength === 0) return yield* new BadRequest({ message: `${field} is empty.` })
    if (bytes.byteLength > MCP_INLINE_MAX_BYTES) {
      return yield* new BadRequest({
        message: `${field} is ${bytes.byteLength} bytes; inline max is ${MCP_INLINE_MAX_BYTES}. Use get_upload_url.`,
      })
    }
    return bytes
  })
}

function uploadInline(
  userId: string,
  origin: string,
  input: { project: string; name: string; bytes: Uint8Array<ArrayBuffer>; ttl?: number },
) {
  return Effect.gen(function* () {
    const projects = yield* Projects
    const target = yield* projects.resolve(userId, input.project)
    const ttlSeconds = yield* resolveTtl({
      userId,
      projectTtlSeconds: target.ttlSeconds,
      ttlSeconds: input.ttl,
    })
    const artifacts = yield* Artifacts
    const result = yield* artifacts.upload({
      userId,
      projectId: target.id,
      name: input.name,
      size: input.bytes.byteLength,
      body: new Blob([input.bytes]).stream(),
      ttlSeconds,
      uploadedBy: 'mcp',
    })
    return yield* uploadResult(origin, result)
  })
}

function makeServer(runtime: AppRuntime, userId: string, origin: string) {
  const server = new McpServer(
    { name: 'artifacts', version: '1.0.0' },
    {
      jsonSchemaValidator: validator,
      instructions,
    },
  )

  server.registerTool('discover', { description: toolDescriptions.discover }, () =>
    runTool(
      runtime,
      Effect.gen(function* () {
        const projects = yield* Projects
        return {
          projects: (yield* projects.list(userId)).map((p) => ({ id: p.id, name: p.name })),
          ...usage(origin),
        }
      }),
    ),
  )

  server.registerTool(
    'get_upload_url',
    {
      description: toolDescriptions.get_upload_url,
      inputSchema: z.object({
        project: z.string().describe('Project id or slug. Unknown slugs are created.'),
        name: z.string().describe('File name with extension, e.g. playwright-report.zip'),
        ttl: z.number().int().positive().optional().describe('Retention in seconds, max 90 days.'),
      }),
    },
    ({ project, name, ttl }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const tickets = yield* Tickets
          const ticket = yield* tickets.create(userId, { project, name, ttl }, 'mcp')
          const url = `${origin}/u/${ticket.id}`
          return {
            url,
            expiresAt: ticket.expiresAt.toISOString(),
            curl: `curl -X PUT --data-binary @${JSON.stringify(name)} ${JSON.stringify(url)}`,
          }
        }),
      ),
  )

  server.registerTool(
    'upload',
    {
      description: toolDescriptions.upload,
      inputSchema: z.object({
        project: z.string().describe('Project id or slug. Unknown slugs are created.'),
        name: z.string().describe('File name with extension, e.g. screenshot.png'),
        contentBase64: z.string().describe('The file bytes, base64.'),
        ttl: z.number().int().positive().optional().describe('Retention in seconds, max 90 days.'),
      }),
    },
    ({ project, name, contentBase64, ttl }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const bytes = yield* inlineFile(contentBase64, 'contentBase64')
          return yield* uploadInline(userId, origin, { project, name, bytes, ttl })
        }),
      ),
  )

  server.registerTool(
    'upload_comparison',
    {
      description: toolDescriptions.upload_comparison,
      inputSchema: z.object({
        project: z.string().describe('Project id or slug. Unknown slugs are created.'),
        name: z
          .string()
          .describe('Name of the comparison, e.g. checkout-redesign. Saved as a zip.'),
        pairs: z
          .array(
            z.object({
              label: z
                .string()
                .regex(
                  /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}$/,
                  'Use letters, digits, space, dot, dash.',
                )
                .describe('Heading for this pair, e.g. login-page.'),
              format: z
                .enum(['png', 'jpg', 'webp', 'gif', 'mp4', 'webm'])
                .describe('File format of both files in this pair.'),
              beforeBase64: z.string().describe('The before file bytes, base64.'),
              afterBase64: z.string().describe('The after file bytes, base64.'),
              diffBase64: z
                .string()
                .optional()
                .describe(
                  'Optional PNG that marks the changed pixels, e.g. from agent-browser diff screenshot --baseline before.png --output diff.png. Image pairs only.',
                ),
              snapshotDiff: z
                .string()
                .optional()
                .describe(
                  'Optional plain text, the output of agent-browser diff snapshot --baseline before.txt. Shown under the images as a unified diff. Image pairs only.',
                ),
            }),
          )
          .min(1)
          .max(20)
          .describe('Pairs in display order. Images and videos can mix.'),
        ttl: z.number().int().positive().optional().describe('Retention in seconds, max 90 days.'),
      }),
    },
    ({ project, name, pairs, ttl }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const labels = new Set(pairs.map((p) => p.label))
          if (labels.size !== pairs.length) {
            return yield* new BadRequest({ message: 'Pair labels must be unique.' })
          }
          const files = []
          for (const [i, pair] of pairs.entries()) {
            const before = yield* inlineFile(pair.beforeBase64, `pairs[${i}].beforeBase64`)
            const after = yield* inlineFile(pair.afterBase64, `pairs[${i}].afterBase64`)
            files.push(
              { name: `${pair.label}/before.${pair.format}`, bytes: before },
              { name: `${pair.label}/after.${pair.format}`, bytes: after },
            )
            const video = pair.format === 'mp4' || pair.format === 'webm'
            if (pair.diffBase64 !== undefined) {
              if (video) {
                return yield* new BadRequest({
                  message: `pairs[${i}].diffBase64 is only for image pairs.`,
                })
              }
              const diff = yield* inlineFile(pair.diffBase64, `pairs[${i}].diffBase64`)
              files.push({ name: `${pair.label}/diff.png`, bytes: diff })
            }
            if (pair.snapshotDiff !== undefined) {
              if (video) {
                return yield* new BadRequest({
                  message: `pairs[${i}].snapshotDiff is only for image pairs.`,
                })
              }
              const snapshot = new TextEncoder().encode(pair.snapshotDiff)
              if (snapshot.byteLength === 0 || snapshot.byteLength > MCP_INLINE_MAX_BYTES) {
                return yield* new BadRequest({
                  message: `pairs[${i}].snapshotDiff is empty or over ${MCP_INLINE_MAX_BYTES} bytes.`,
                })
              }
              files.push({ name: `${pair.label}/diff.txt`, bytes: snapshot })
            }
          }
          const bytes = buildStoredZip(files)
          const zipName = name.toLowerCase().endsWith('.zip') ? name : `${name}.zip`
          return yield* uploadInline(userId, origin, { project, name: zipName, bytes, ttl })
        }),
      ),
  )

  return server
}

export async function mcpRoute(env: ApiEnv, request: Request): Promise<Response> {
  const runtime = getRuntime(env)
  const { auth, appUrl } = await runtime.runPromise(
    Effect.flatMap(Auth, (a) => Effect.all({ auth: a.instance, appUrl: a.appUrl })),
  )
  const { baseURL } = await auth.$context
  const origin = new URL(request.url).origin
  const protectedHandler = createMcpProtectedRequestHandler(
    {
      issuer: baseURL,
      audience: mcpResource(appUrl),
      // A Worker cannot fetch its own domain, so the key set is read in-process.
      // The verifier accepts a function here; the option is only typed as a URL.
      jwksUrl: (() => auth.api.getJwks()) as unknown as string,
    },
    (req, claims) => {
      const userId = typeof claims.sub === 'string' ? claims.sub : null
      if (!userId) return new Response('Token has no subject.', { status: 401 })
      return createMcpHandler(() => makeServer(runtime, userId, origin)).fetch(req)
    },
  )
  return withGuide(await protectedHandler(request), origin)
}

// Clients start OAuth from the 401 headers. The body adds the guide for agents that read it.
export async function withGuide(response: Response, origin: string) {
  if (response.status !== 401 || !response.headers.get('content-type')?.includes('json')) {
    return response
  }
  const body = (await response.json()) as { error: object }
  body.error = {
    ...body.error,
    message:
      'Not signed in. Read error.data.guide to upload with an API token or connect over MCP.',
    data: { guide: guide(origin) },
  }
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return Response.json(body, { status: 401, headers })
}

// GET without an event stream is a person or an agent that fetches the URL.
export function mcpGet(request: Request) {
  if (request.headers.get('accept')?.includes('text/event-stream')) {
    return new Response('Method not allowed.', { status: 405, headers: { allow: 'POST' } })
  }
  return new Response(guide(new URL(request.url).origin), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })
}
