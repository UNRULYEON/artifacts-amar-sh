const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

// prefix + base64url of `bytes` random bytes. 16 bytes is 128 bits.
export function newId(prefix: string, bytes = 16) {
  const raw = crypto.getRandomValues(new Uint8Array(bytes))
  let out = ''
  for (let i = 0; i < raw.length; i += 3) {
    const n = (raw[i]! << 16) | ((raw[i + 1] ?? 0) << 8) | (raw[i + 2] ?? 0)
    out += alphabet[(n >> 18) & 63]! + alphabet[(n >> 12) & 63]!
    if (i + 1 < raw.length) out += alphabet[(n >> 6) & 63]!
    if (i + 2 < raw.length) out += alphabet[n & 63]!
  }
  return `${prefix}_${out}`
}
