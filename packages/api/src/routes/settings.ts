import { Effect } from 'effect'
import type { Route } from '../http'
import { SettingsService, UpdateSettings } from '../services/settings'
import { currentUserId, jsonBody } from './helpers'

export function getSettings(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const settings = yield* SettingsService
    return Response.json(yield* settings.get(userId))
  })
}

export function updateSettings(request: Request): Route {
  return Effect.gen(function* () {
    const userId = yield* currentUserId(request)
    const patch = yield* jsonBody(request, UpdateSettings)
    const settings = yield* SettingsService
    return Response.json(yield* settings.update(userId, patch))
  })
}
