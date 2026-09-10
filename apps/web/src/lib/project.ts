import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { ArtifactSummary, Project } from '@artifacts/api'

export interface ProjectView {
  origin: string
  project: Project
  artifacts: ArtifactSummary[]
}

export const getProject = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<ProjectView | null> => {
    const { readProject } = await import('./project.server')
    const request = getRequest()
    return readProject(request.headers, new URL(request.url).origin, id)
  })
