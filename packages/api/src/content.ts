import { Config, Effect, Option } from 'effect'

// Artifact bytes are served from CONTENT_URL when it is set, a separate origin
// where reports may keep same-origin storage without reaching the app. Without
// it (local dev) bytes stay on the app origin in an opaque sandbox.

const contentUrl = Config.string('CONTENT_URL').pipe(Config.option)

export function contentOrigin(fallback: string) {
  return Effect.map(contentUrl, (url) => Option.getOrElse(url, () => fallback))
}

export function isContentOrigin(request: Request, url: string | undefined) {
  return url !== undefined && new URL(request.url).origin === url
}
