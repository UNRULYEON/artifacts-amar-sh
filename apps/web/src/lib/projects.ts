import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { Project } from '@artifacts/api'

export const getProjects = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Project[]> => {
    const { readProjects } = await import('./projects.server')
    return readProjects(getRequest().headers)
  },
)
