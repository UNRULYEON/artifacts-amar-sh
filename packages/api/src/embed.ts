import { Effect } from 'effect'
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
  return Effect.map(
    Effect.flatMap(Signer, (signer) => signer.signEmbed(artifact.id, new Date(artifact.expiresAt))),
    (token) => `${origin}/r/${artifact.id}/${token}/${encodeURIComponent(artifact.name)}`,
  )
}
