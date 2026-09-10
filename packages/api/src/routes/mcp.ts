import { createMcpProtectedRequestHandler } from '@better-auth/mcp'
import { createMcpHandler, McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/server/validators/cf-worker'
import { Cause, Effect } from 'effect'
import * as z from 'zod'
import type { ApiEnv } from '../env'
import { BadRequest } from '../errors'
import { MAX_UPLOAD_BYTES, MCP_INLINE_MAX_BYTES } from '../limits'
import { getRuntime, type AppRuntime, type AppServices } from '../runtime'
import { Artifacts } from '../services/artifacts'
import { Auth, mcpResource } from '../services/auth'
import { Projects } from '../services/projects'
import { Tickets } from '../services/tickets'
import { fromBase64url } from '../encoding'
import { resolveTtl } from './upload'

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

function decodeBase64(value: string) {
  const compact = value.replace(/\s+/g, '')
  const bytes = fromBase64url(compact.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, ''))
  return bytes
    ? Effect.succeed(bytes)
    : Effect.fail(new BadRequest({ message: 'contentBase64 is not base64.' }))
}

function makeServer(runtime: AppRuntime, userId: string, origin: string) {
  const server = new McpServer(
    { name: 'artifacts', version: '1.0.0' },
    {
      jsonSchemaValidator: validator,
      instructions:
        'Upload screenshots, videos, logs, and zipped HTML reports to artifacts.amar.sh and get a viewer URL back. Start with discover.',
    },
  )

  server.registerTool(
    'discover',
    { description: 'How uploads work, the limits, and the list of projects.' },
    () =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const projects = yield* Projects
          return {
            projects: (yield* projects.list(userId)).map((p) => ({ id: p.id, name: p.name })),
            notes: [
              'Tokens and this MCP session can upload to every project. An unknown project name is created.',
              `Files up to ${MCP_INLINE_MAX_BYTES} bytes: call upload with contentBase64.`,
              `Larger files up to ${MAX_UPLOAD_BYTES} bytes: call get_upload_url, then run the returned curl in a shell.`,
              'The response url opens in a browser after GitHub login. Bundles (zip with index.html) open as a site.',
            ],
            uploadTicketShape: `curl -X PUT --data-binary @<file> ${origin}/u/<ticket>`,
          }
        }),
      ),
  )

  server.registerTool(
    'get_upload_url',
    {
      description:
        'Mint a one-use upload URL (10 minutes) for a file of any size up to 100MB. Returns the URL and a ready curl command.',
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
      description: 'Upload a small file (up to 2MB) inline. Returns the viewer URL.',
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
          const bytes = yield* decodeBase64(contentBase64)
          if (bytes.byteLength === 0) return yield* new BadRequest({ message: 'File is empty.' })
          if (bytes.byteLength > MCP_INLINE_MAX_BYTES) {
            return yield* new BadRequest({
              message: `File is ${bytes.byteLength} bytes; inline max is ${MCP_INLINE_MAX_BYTES}. Use get_upload_url.`,
            })
          }
          const projects = yield* Projects
          const target = yield* projects.resolve(userId, project)
          const ttlSeconds = yield* resolveTtl({
            userId,
            projectTtlSeconds: target.ttlSeconds,
            ttlSeconds: ttl,
          })
          const artifacts = yield* Artifacts
          const result = yield* artifacts.upload({
            userId,
            projectId: target.id,
            name,
            size: bytes.byteLength,
            body: new Blob([bytes]).stream(),
            ttlSeconds,
            uploadedBy: 'mcp',
          })
          return { id: result.id, url: `${origin}/a/${result.id}`, expiresAt: result.expiresAt }
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
  return protectedHandler(request)
}
