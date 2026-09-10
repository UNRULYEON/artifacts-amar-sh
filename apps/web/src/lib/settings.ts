import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import type { Settings, Token } from '@artifacts/api'

export interface SettingsView {
  settings: Settings
  tokens: Token[]
}

export const getSettingsView = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SettingsView | null> => {
    const { readSettingsView } = await import('./settings.server')
    return readSettingsView(getRequest().headers)
  },
)
