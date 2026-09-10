import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

export interface ArtifactView {
  id: string
  name: string
  kind: 'image' | 'video' | 'bundle' | 'page' | 'file'
  size: number
  createdAt: string
  expiresAt: string
  project: { id: string; name: string; displayName: string | null } | null
  // Signed prefix, valid for an hour. Paths are relative to the bundle root.
  base: string
  files: { path: string; size: number }[]
  hasIndex: boolean
}

export const getArtifact = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<ArtifactView | null> => {
    const { readArtifact } = await import('./artifacts.server')
    return readArtifact(getRequest().headers, id)
  })
