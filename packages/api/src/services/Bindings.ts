import { Context, Layer } from 'effect'
import type { ApiEnv } from '../env'

// The raw Worker bindings. Only other services should read this; routes use
// the typed services built on top of it.
export class Bindings extends Context.Tag('@artifacts/api/Bindings')<Bindings, ApiEnv>() {
  static readonly layer = (env: ApiEnv) => Layer.succeed(Bindings, env)
}
