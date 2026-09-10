import * as D1Client from '@effect/sql-d1/D1Client'
import { ConfigProvider, Layer, ManagedRuntime } from 'effect'
import type { ApiEnv } from './env'
import { Artifacts } from './services/artifacts'
import { Auth } from './services/auth'
import { Bindings } from './services/bindings'
import { Database } from './services/database'
import { Projects } from './services/projects'
import { Retention } from './services/retention'
import { SettingsService } from './services/settings'
import { Signer } from './services/signer'
import { Storage } from './services/storage'
import { Tokens } from './services/tokens'

export function makeAppLayer(env: ApiEnv) {
  const bindings = Bindings.layer(env)
  const sql = D1Client.layer({ db: env.DB })
  const config = Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string')),
    ),
  )
  const database = Database.layer.pipe(Layer.provide(sql))
  const storage = Storage.Default.pipe(Layer.provide(bindings))
  return Layer.mergeAll(
    Artifacts.Default.pipe(Layer.provide(Layer.merge(database, storage))),
    Auth.Default.pipe(Layer.provide(database)),
    Projects.Default.pipe(Layer.provide(database)),
    Tokens.Default.pipe(Layer.provide(database)),
    Signer.Default,
    SettingsService.Default.pipe(Layer.provide(database)),
    Retention.Default.pipe(Layer.provide(Layer.merge(database, storage))),
    database,
    sql,
    storage,
    bindings,
  ).pipe(Layer.provide(config))
}

export type AppLayer = ReturnType<typeof makeAppLayer>
export type AppServices = Layer.Layer.Success<AppLayer>
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, Layer.Layer.Error<AppLayer>>

// The env object is stable for the life of an isolate, so one runtime per env.
const runtimes = new WeakMap<ApiEnv, AppRuntime>()

export function getRuntime(env: ApiEnv): AppRuntime {
  let runtime = runtimes.get(env)
  if (!runtime) {
    runtime = ManagedRuntime.make(makeAppLayer(env))
    runtimes.set(env, runtime)
  }
  return runtime
}
