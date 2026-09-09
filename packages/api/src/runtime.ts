import * as D1Client from '@effect/sql-d1/D1Client'
import { ConfigProvider, Layer, ManagedRuntime } from 'effect'
import type { ApiEnv } from './env'
import { Bindings } from './services/Bindings'
import { Database } from './services/Database'
import { Storage } from './services/Storage'

// Everything a request handler may depend on, built from the Worker env.
export const makeAppLayer = (env: ApiEnv) => {
  const bindings = Bindings.layer(env)
  const sql = D1Client.layer({ db: env.DB })
  // Plain string vars (APP_URL, secrets) are readable through `Config`.
  const config = Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(Object.entries(env).filter((e): e is [string, string] => typeof e[1] === 'string')),
    ),
  )
  return Layer.mergeAll(
    Database.layer.pipe(Layer.provide(sql)),
    sql,
    Storage.Default.pipe(Layer.provide(bindings)),
    bindings,
  ).pipe(Layer.provide(config))
}

export type AppLayer = ReturnType<typeof makeAppLayer>
export type AppServices = Layer.Layer.Success<AppLayer>
export type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, Layer.Layer.Error<AppLayer>>

// One runtime per Worker env object. The env is stable for the life of an
// isolate, so layers are built once and reused across requests.
const runtimes = new WeakMap<ApiEnv, AppRuntime>()

export const getRuntime = (env: ApiEnv): AppRuntime => {
  let runtime = runtimes.get(env)
  if (!runtime) {
    runtime = ManagedRuntime.make(makeAppLayer(env))
    runtimes.set(env, runtime)
  }
  return runtime
}
