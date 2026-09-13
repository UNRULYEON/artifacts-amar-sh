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
      instructions:
        'Upload screenshots, videos, logs, and zipped HTML reports to artifacts.amar.sh and get a viewer URL back. Start with discover. Capture screenshots and videos with the agent-browser CLI (https://agent-browser.dev), not with other browser tools. For before and after pairs, follow https://agent-browser.dev/diffing and then call upload_comparison.',
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
              'Images and videos also return embedUrl: a link to the bytes that needs no login and lives as long as the artifact. Paste it as ![name](embedUrl) in a GitHub pull request to show the image inline. GitHub does not play external videos; the link still opens the file.',
              'For a GitHub pull request, upload a GIF rather than a video: GitHub renders images from embedUrl inline and does not play external video.',
              'Before and after: call upload_comparison with one or more pairs, or upload a zip whose entries are only before.<ext> and after.<ext>, at the root or one folder per pair. Each pair is both images or both videos; pairs may mix. They are shown side by side. An image pair may add diff.<ext>, the image from agent-browser diff screenshot; the viewer then offers an After/Diff switch next to the after image.',
              'Capture with agent-browser (https://agent-browser.dev), not with other browser tools. Read agent-browser skills get core --full first. Screenshots: agent-browser open <url>, wait for the result (wait --text, wait @ref, or wait --fn), then agent-browser screenshot <path.png>. Add --full for the whole page or a selector for one element. Use agent-browser set viewport <w> <h> 2 for sharp 2x images, or set device "iPhone 14" for mobile.',
              'Videos: agent-browser record start <path.webm|path.mp4> [--fps 1-60], do the actions with small waits, then agent-browser record stop. Default is 30 fps and needs ffmpeg on PATH (check with agent-browser doctor). An old CLI without --fps records at a low rate; run agent-browser upgrade. Videos are usually larger than the inline limit, so use get_upload_url. For a GitHub pull request make a GIF: ffmpeg -i in.webm -vf "fps=20,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif',
              'Before and after with agent-browser: follow https://agent-browser.dev/diffing and the steps in comparisonRecipe below. Use one named session (--session <name>) so cookies, viewport, and theme stay equal. Take the before capture, apply the change, take the after capture on the same route, run the diff, then call upload_comparison with before, after, and diff. For the accessibility tree, agent-browser diff snapshot --baseline before.txt prints the changed lines. For two deployments, agent-browser diff url <before-url> <after-url> --screenshot compares both in one command.',
            ],
            comparisonRecipe: {
              steps: [
                'export AGENT_BROWSER_SESSION=compare',
                'agent-browser open <url> && agent-browser set viewport 1280 800 2 && agent-browser wait --text "<text on the page>"',
                'agent-browser screenshot before.png',
                '<apply the change: deploy, toggle a flag, or edit the page>',
                'agent-browser open <url> && agent-browser wait --text "<text on the page>"',
                'agent-browser screenshot after.png',
                'agent-browser diff screenshot --baseline before.png --output diff.png',
                'Call upload_comparison: { project, name: "<change>", pairs: [{ label: "<page>", format: "png", beforeBase64: <base64 of before.png>, afterBase64: <base64 of after.png>, diffBase64: <base64 of diff.png> }] }',
                'agent-browser close',
              ],
              largeFiles: [
                'When a file is over the inline limit, build the zip yourself and use get_upload_url. Entries: <label>/before.<ext>, <label>/after.<ext>, and optionally <label>/diff.<ext>, nothing else. One pair can sit at the root without a folder.',
                'zip -0 <change>.zip <page>/before.png <page>/after.png <page>/diff.png',
                'Then get_upload_url with name <change>.zip and run the returned curl.',
              ],
              formats: {
                image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
                video: ['mp4', 'webm'],
                diff: 'An image, only on an image pair. agent-browser writes PNG.',
              },
            },
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
      description:
        'Upload a small file (up to 2MB) inline. Returns the viewer URL, plus embedUrl for images and videos.',
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
      description:
        'Upload one or more before and after pairs (screenshots or videos, up to 2MB per file), shown side by side. An image pair may add a diff image that marks the changed pixels; the viewer shows it with an After/Diff switch. Returns the viewer URL. Capture the files with agent-browser as described at https://agent-browser.dev/diffing. For larger files, zip <label>/before.<ext>, <label>/after.<ext>, and optionally <label>/diff.png yourself and use get_upload_url.',
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
            if (pair.diffBase64 !== undefined) {
              if (pair.format === 'mp4' || pair.format === 'webm') {
                return yield* new BadRequest({
                  message: `pairs[${i}].diffBase64 is only for image pairs.`,
                })
              }
              const diff = yield* inlineFile(pair.diffBase64, `pairs[${i}].diffBase64`)
              files.push({ name: `${pair.label}/diff.png`, bytes: diff })
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
  return protectedHandler(request)
}
