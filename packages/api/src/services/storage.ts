import { Effect } from 'effect'
import { StorageError } from '../errors'
import { Bindings } from './bindings'

export class Storage extends Effect.Service<Storage>()('@artifacts/api/Storage', {
  effect: Effect.gen(function* () {
    const { BUCKET } = yield* Bindings

    function use<A>(op: string, f: (bucket: R2Bucket) => Promise<A>) {
      return Effect.tryPromise({
        try: () => f(BUCKET),
        catch: (cause) => new StorageError({ op, cause }),
      }).pipe(Effect.withSpan(`Storage.${op}`))
    }

    return {
      put(key: string, body: ReadableStream | ArrayBuffer | string, options?: R2PutOptions) {
        return use('put', (b) => b.put(key, body, options))
      },
      get(key: string, options?: R2GetOptions) {
        return use('get', (b) => b.get(key, options))
      },
      head(key: string) {
        return use('head', (b) => b.head(key))
      },
      delete(keys: string | string[]) {
        return use('delete', (b) => b.delete(keys))
      },
    }
  }),
}) {}
