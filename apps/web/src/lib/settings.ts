import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { Settings, Token } from '@artifacts/api'

export interface SettingsView {
  settings: Settings
  tokens: Token[]
  origin: string
}

export const getSettingsView = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SettingsView | null> => {
    const { readSettingsView } = await import('./settings.server')
    const request = getRequest()
    const view = await readSettingsView(request.headers)
    return view && { ...view, origin: new URL(request.url).origin }
  },
)
