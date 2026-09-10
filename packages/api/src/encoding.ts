const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function base64url(raw: Uint8Array) {
  let out = ''
  for (let i = 0; i < raw.length; i += 3) {
    const n = (raw[i]! << 16) | ((raw[i + 1] ?? 0) << 8) | (raw[i + 2] ?? 0)
    out += alphabet[(n >> 18) & 63]! + alphabet[(n >> 12) & 63]!
    if (i + 1 < raw.length) out += alphabet[(n >> 6) & 63]!
    if (i + 2 < raw.length) out += alphabet[n & 63]!
  }
  return out
}

// null when the text is not base64url.
export function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  const padded =
    text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (text.length % 4)) % 4)
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}
