import { MAX_UPLOAD_BYTES, MCP_INLINE_MAX_BYTES } from './limits'

// How to use the service, for agents. The MCP server instructions and discover
// use it, /mcp without a sign-in answers with guide(), and /api/help with apiHelp().

export const instructions =
  'Upload screenshots, videos, logs, and zipped HTML reports to artifacts.amar.sh and get a viewer URL back. Start with discover. Capture screenshots and videos with the agent-browser CLI (https://agent-browser.dev), not with other browser tools. For before and after pairs, follow https://agent-browser.dev/diffing and then call upload_comparison.'

export const toolDescriptions = {
  discover: 'How uploads work, the limits, and the list of projects.',
  get_upload_url:
    'Mint a one-use upload URL (10 minutes) for a file of any size up to 100MB. Returns the URL and a ready curl command.',
  upload:
    'Upload a small file (up to 2MB) inline. Returns the viewer URL, plus embedUrl for images and videos.',
  upload_comparison:
    'Upload one or more before and after pairs (screenshots or videos, up to 2MB per file), shown side by side or as a swipe. An image pair may add a diff image that marks the changed pixels, shown with an After/Diff switch, and a snapshot diff, the text from agent-browser diff snapshot, shown under the images. Returns the viewer URL. Capture the files with agent-browser as described at https://agent-browser.dev/diffing. For larger files, zip <label>/before.<ext>, <label>/after.<ext>, and optionally <label>/diff.png and <label>/diff.txt yourself and use get_upload_url.',
}

const captureSteps = [
  'export AGENT_BROWSER_SESSION=compare',
  'agent-browser open <url> && agent-browser set viewport 1280 800 2 && agent-browser wait --text "<text on the page>"',
  'agent-browser screenshot before.png && agent-browser snapshot > before.txt',
  '<apply the change: deploy, toggle a flag, or edit the page>',
  'agent-browser open <url> && agent-browser wait --text "<text on the page>"',
  'agent-browser screenshot after.png',
  'agent-browser diff screenshot --baseline before.png --output diff.png',
  'agent-browser diff snapshot --baseline before.txt > diff.txt',
]

const gifCommand =
  'ffmpeg -i in.webm -vf "fps=20,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif'

const screenshotNote =
  'Capture with agent-browser (https://agent-browser.dev), not with other browser tools. Read agent-browser skills get core --full first. Screenshots: agent-browser open <url>, wait for the result (wait --text, wait @ref, or wait --fn), then agent-browser screenshot <path.png>. Add --full for the whole page or a selector for one element. Use agent-browser set viewport <w> <h> 2 for sharp 2x images, or set device "iPhone 14" for mobile.'

export function usage(origin: string) {
  return {
    notes: [
      'Tokens and this MCP session can upload to every project. An unknown project name is created.',
      `Files up to ${MCP_INLINE_MAX_BYTES} bytes: call upload with contentBase64.`,
      `Larger files up to ${MAX_UPLOAD_BYTES} bytes: call get_upload_url, then run the returned curl in a shell.`,
      'The response url opens in a browser after GitHub login. Bundles (zip with index.html) open as a site.',
      'Images and videos also return embedUrl: a link to the bytes that needs no login and lives as long as the artifact. Paste it as ![name](embedUrl) in a GitHub pull request to show the image inline. GitHub does not play external videos; the link still opens the file.',
      'For a GitHub pull request, upload a GIF rather than a video: GitHub renders images from embedUrl inline and does not play external video.',
      'Before and after: call upload_comparison with one or more pairs, or upload a zip whose entries are only before.<ext> and after.<ext>, at the root or one folder per pair. Each pair is both images or both videos; pairs may mix. They are shown side by side, and image pairs also as a swipe. An image pair may add diff.<ext>, the image from agent-browser diff screenshot, shown with an After/Diff switch, and diff.txt, the text from agent-browser diff snapshot, shown under the images.',
      screenshotNote,
      `Videos: agent-browser record start <path.webm|path.mp4> [--fps 1-60], do the actions with small waits, then agent-browser record stop. Default is 30 fps and needs ffmpeg on PATH (check with agent-browser doctor). An old CLI without --fps records at a low rate; run agent-browser upgrade. Videos are usually larger than the inline limit, so use get_upload_url. For a GitHub pull request make a GIF: ${gifCommand}`,
      'Before and after with agent-browser: follow https://agent-browser.dev/diffing and the steps in comparisonRecipe below. Use one named session (--session <name>) so cookies, viewport, and theme stay equal. Take the before capture, apply the change, take the after capture on the same route, run both diffs, then call upload_comparison with before, after, diff, and the snapshot diff text. For two deployments, agent-browser diff url <before-url> <after-url> --screenshot compares both in one command.',
    ],
    comparisonRecipe: {
      steps: [
        ...captureSteps,
        'Call upload_comparison: { project, name: "<change>", pairs: [{ label: "<page>", format: "png", beforeBase64: <base64 of before.png>, afterBase64: <base64 of after.png>, diffBase64: <base64 of diff.png>, snapshotDiff: <text of diff.txt> }] }',
        'agent-browser close',
      ],
      largeFiles: [
        'When a file is over the inline limit, build the zip yourself and use get_upload_url. Entries: <label>/before.<ext>, <label>/after.<ext>, and optionally <label>/diff.<ext> and <label>/diff.txt, nothing else. One pair can sit at the root without a folder.',
        'zip -0 <change>.zip <page>/before.png <page>/after.png <page>/diff.png <page>/diff.txt',
        'Then get_upload_url with name <change>.zip and run the returned curl.',
      ],
      formats: {
        image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
        video: ['mp4', 'webm'],
        diff: 'An image, only on an image pair. agent-browser writes PNG.',
        snapshot: 'diff.txt, plain text from agent-browser diff snapshot, only on an image pair.',
      },
    },
    uploadTicketShape: `curl -X PUT --data-binary @<file> ${origin}/u/<ticket>`,
  }
}

function list(items: string[]) {
  return items.map((item) => `- ${item}`).join('\n')
}

function uploadCurl(origin: string, name = 'report.zip') {
  return `curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" \\
  --data-binary @${name} \\
  "${origin}/api/upload?project=<project>&name=${name}"`
}

function tokenSection(origin: string) {
  return `## Upload with an API token

The simplest way: one request, no sign-in flow, no upload URL. The owner makes a token (\`art_...\`) at ${origin}/settings.

\`\`\`sh
${uploadCurl(origin)}
\`\`\`

${list([
  'The body is the raw file, not multipart. Files up to 100MB.',
  '`project` is a project id or slug. An unknown slug creates the project.',
  '`name` is the file name. Its extension sets the kind: png, jpg, webp, gif image; mp4, webm video; zip bundle; html page; else file.',
  '`ttl` is optional, in seconds, 60 seconds to 90 days. Without it the project retention, then the owner default, then 30 days applies.',
  'The answer is `201 { id, url, expiresAt, embedUrl? }`. Paste embedUrl as `![name](embedUrl)` in a GitHub pull request to show an image inline.',
  'A zip with index.html opens as a site, for example a Playwright report.',
  'Before and after: zip `<label>/before.<ext>`, `<label>/after.<ext>`, and optionally `<label>/diff.png` and `<label>/diff.txt`, one folder per pair, then upload the zip. Example: `zip -0 checkout.zip login/before.png login/after.png login/diff.png login/diff.txt`.',
  'Errors: 401 bad token, 411 no Content-Length, 413 over 100MB, 400 a bad zip or a body that does not match its length.',
])}

Check a token and list its projects with \`curl -H "Authorization: Bearer $ARTIFACTS_TOKEN" ${origin}/api/help\`.`
}

// Markdown for /mcp without a sign-in.
export function guide(origin: string) {
  const { notes, comparisonRecipe } = usage(origin)
  return `# Artifacts

Upload screenshots, videos, logs, and zipped HTML reports, and get a viewer URL back. One owner runs this service. Viewer URLs need the owner's GitHub login. Images and videos also get an embedUrl that needs no login.

You are not signed in. Use an API token, or connect over MCP. Only the owner can make a token or sign in, so ask them if you have neither.

${tokenSection(origin)}

## Connect over MCP

Add \`${origin}/mcp\` as a streamable HTTP server (POST only). The client finds OAuth at \`${origin}/.well-known/oauth-protected-resource/mcp\` and registers with a Client ID Metadata Document (an HTTPS client_id). The owner signs in with GitHub and consents once. Claude Code: \`claude mcp add --transport http --scope user artifacts ${origin}/mcp\`, then run \`/mcp\` to sign in.

The OAuth token stays in the MCP client, so large files go through a one-use upload URL from get_upload_url.

Tools:

${list(Object.entries(toolDescriptions).map(([name, description]) => `\`${name}\`: ${description}`))}

## Uploads and captures over MCP

${list(notes)}

## Before and after recipe

${comparisonRecipe.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

With an API token, zip the files in place of the upload_comparison step and upload the zip with curl.

Large files over MCP:

${list(comparisonRecipe.largeFiles)}

Formats: images ${comparisonRecipe.formats.image.join(', ')}; videos ${comparisonRecipe.formats.video.join(', ')}. ${comparisonRecipe.formats.diff} ${comparisonRecipe.formats.snapshot}
`
}

export type HelpToken = 'missing' | 'invalid' | { projects: { id: string; name: string }[] }

function tokenStatus(origin: string, token: HelpToken) {
  if (token === 'missing') {
    return `No token sent. Send \`Authorization: Bearer art_...\` to this URL to check the token and list its projects. The owner makes tokens at ${origin}/settings.`
  }
  if (token === 'invalid') {
    return `The token is not valid. It may be revoked. Ask the owner for a new one at ${origin}/settings.`
  }
  if (token.projects.length === 0) {
    return 'The token is valid and can upload to every project. There are no projects yet. The first upload creates one.'
  }
  return `The token is valid and can upload to every project. Use a project name below, or a new name to create a project.

${list(token.projects.map((p) => `\`${p.name}\` (${p.id})`))}`
}

// Markdown for /api/help, for agents that upload with an API token.
export function apiHelp(origin: string, token: HelpToken) {
  const steps = [
    ...captureSteps,
    'mkdir <page> && mv before.png after.png diff.png diff.txt <page>/',
    'zip -0 <change>.zip <page>/before.png <page>/after.png <page>/diff.png <page>/diff.txt',
    uploadCurl(origin, '<change>.zip').replaceAll('\\\n  ', ''),
    'agent-browser close',
  ]
  return `# Artifacts API

Upload screenshots, videos, logs, and zipped HTML reports, and get a viewer URL back. One owner runs this service. Viewer URLs need the owner's GitHub login. Images and videos also get an embedUrl that needs no login.

## Your token

${tokenStatus(origin, token)}

${tokenSection(origin)}

## Upload URLs

To let a step without the token upload one file, mint a one-use URL. It lives 10 minutes and is bound to the project and the file name.

\`\`\`sh
curl -X POST -H "Authorization: Bearer $ARTIFACTS_TOKEN" -H "Content-Type: application/json" \\
  -d '{"project":"<project>","name":"shot.png","ttl":86400}' \\
  ${origin}/api/upload-tickets
\`\`\`

The answer is \`201 { url, expiresAt, curl }\`. Run the curl, \`curl -X PUT --data-binary @shot.png <url>\`, with no token. It answers like \`/api/upload\`.

## Captures

${list([
  screenshotNote,
  `Videos: agent-browser record start <path.webm|path.mp4> [--fps 1-60], do the actions with small waits, then agent-browser record stop. It needs ffmpeg on PATH. GitHub does not play external video, so for a pull request make a GIF: ${gifCommand}`,
])}

## Before and after with agent-browser

Follow https://agent-browser.dev/diffing. Keep one session so cookies, viewport, and theme stay equal.

${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Each pair is both images (png, jpg, jpeg, webp, gif) or both videos (mp4, webm). Only image pairs take diff.png and diff.txt. For several pages, add one folder per page to the same zip.

## MCP

Agents that support MCP can connect to \`${origin}/mcp\` with OAuth. GET that URL for the MCP guide.
`
}
