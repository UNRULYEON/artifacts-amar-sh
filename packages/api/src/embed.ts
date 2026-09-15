import { Effect } from 'effect'
import { contentOrigin } from './content'
import type { Kind } from './mime'
import { Signer } from './services/signer'

export interface Embeddable {
  id: string
  kind: Kind
  name: string
  expiresAt: Date | string
}

// A cookie-free link to the bytes of an image or video, valid until the
// artifact expires. Pasted as ![name](url) it renders in a GitHub PR.
export function embedUrl(origin: string, artifact: Embeddable) {
  if (artifact.kind !== 'image' && artifact.kind !== 'video') return Effect.succeed(null)
  return Effect.gen(function* () {
    const signer = yield* Signer
    const token = yield* signer.signEmbed(artifact.id, new Date(artifact.expiresAt))
    const base = yield* contentOrigin(origin)
    return `${base}/r/${artifact.id}/${token}/${encodeURIComponent(artifact.name)}`
  })
}
