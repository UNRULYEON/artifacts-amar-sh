// Workers transport for CIMD documents. The shipped one is Node only.
// Workers outbound fetch cannot reach private ranges, so no address pinning.

function isIpLiteral(hostname: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[')
}

export function isAllowedMetadataUrl(raw: string) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname !== 'localhost' && !isIpLiteral(url.hostname)
  } catch {
    return false
  }
}

export async function fetchClientMetadata(input: RequestInfo | URL, init?: RequestInit) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!isAllowedMetadataUrl(url)) {
    return new Response('Client metadata must be served over https.', { status: 400 })
  }
  return fetch(input, { ...init, redirect: 'manual' })
}

// MCP_CLIENT_ORIGINS="https://claude.ai,https://cursor.com". Unset allows any
// https document; the CIMD validation still binds redirect URIs to it.
export function makeOriginAllowlist(setting: string | undefined) {
  const origins = (setting ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => new URL(s).origin)
  return (clientIdUrl: string) => {
    if (!isAllowedMetadataUrl(clientIdUrl)) return false
    return origins.length === 0 || origins.includes(new URL(clientIdUrl).origin)
  }
}
