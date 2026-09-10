import { base64url } from './encoding'

// prefix + base64url of `bytes` random bytes. 16 bytes is 128 bits.
export function newId(prefix: string, bytes = 16) {
  return `${prefix}_${base64url(crypto.getRandomValues(new Uint8Array(bytes)))}`
}
