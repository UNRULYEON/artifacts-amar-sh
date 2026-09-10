import { Config, Effect, Redacted } from 'effect'
import { base64url, fromBase64url } from '../encoding'

export const SIGNATURE_TTL_SECONDS = 60 * 60

const encoder = new TextEncoder()
const hmac = { name: 'HMAC', hash: 'SHA-256' } as const

// The URL signing key is derived from the auth secret, so no second secret to set.
async function deriveKey(secret: string) {
  const root = await crypto.subtle.importKey('raw', encoder.encode(secret), hmac, false, ['sign'])
  const raw = await crypto.subtle.sign('HMAC', root, encoder.encode('artifacts:url-signing'))
  return crypto.subtle.importKey('raw', raw, hmac, false, ['sign', 'verify'])
}

function message(id: string, exp: number) {
  return encoder.encode(`${id}.${exp}`)
}

export interface UrlSigner {
  // Returns the `<exp>.<sig>` path segment.
  sign(id: string, now?: number): Promise<string>
  verify(id: string, token: string, now?: number): Promise<boolean>
}

export async function makeSigner(secret: string): Promise<UrlSigner> {
  const key = await deriveKey(secret)
  return {
    async sign(id, now = Date.now()) {
      const exp = Math.floor(now / 1000) + SIGNATURE_TTL_SECONDS
      const sig = await crypto.subtle.sign('HMAC', key, message(id, exp))
      return `${exp}.${base64url(new Uint8Array(sig))}`
    },
    async verify(id, token, now = Date.now()) {
      const dot = token.indexOf('.')
      if (dot === -1) return false
      const exp = Number(token.slice(0, dot))
      const sig = fromBase64url(token.slice(dot + 1))
      if (!Number.isInteger(exp) || !sig || exp * 1000 <= now) return false
      if (exp * 1000 > now + SIGNATURE_TTL_SECONDS * 1000 + 60_000) return false
      return crypto.subtle.verify('HMAC', key, sig, message(id, exp))
    },
  }
}

export class Signer extends Effect.Service<Signer>()('@artifacts/api/Signer', {
  effect: Effect.gen(function* () {
    // Read lazily so a missing secret only breaks signed routes.
    const signer = yield* Effect.cached(
      Config.redacted('BETTER_AUTH_SECRET').pipe(
        Effect.flatMap((secret) => Effect.promise(() => makeSigner(Redacted.value(secret)))),
      ),
    )

    return {
      sign(id: string) {
        return Effect.flatMap(signer, (s) => Effect.promise(() => s.sign(id)))
      },
      verify(id: string, token: string) {
        return Effect.flatMap(signer, (s) => Effect.promise(() => s.verify(id, token)))
      },
    }
  }),
}) {}
