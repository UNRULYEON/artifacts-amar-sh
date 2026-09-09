import { Context, Layer } from 'effect'
import type { ApiEnv } from '../env'

export class Bindings extends Context.Tag('@artifacts/api/Bindings')<Bindings, ApiEnv>() {
  static layer(env: ApiEnv) {
    return Layer.succeed(Bindings, env)
  }
}
