import { Effect } from 'effect'
import { StorageError } from '../errors'
import { Bindings } from './Bindings'

// R2. Thin wrapper so every bucket call is an Effect with a typed failure
// and a tracing span. Add methods here as the upload and viewer code needs them.
export class Storage extends Effect.Service<Storage>()('@artifacts/api/Storage', {
  effect: Effect.gen(function* () {
    const { BUCKET } = yield* Bindings

    const use = <A>(op: string, f: (bucket: R2Bucket) => Promise<A>) =>
      Effect.tryPromise({
        try: () => f(BUCKET),
        catch: (cause) => new StorageError({ op, cause }),
      }).pipe(Effect.withSpan(`Storage.${op}`))

    return {
      put: (key: string, body: ReadableStream | ArrayBuffer | string, options?: R2PutOptions) =>
        use('put', (b) => b.put(key, body, options)),
      get: (key: string, options?: R2GetOptions) => use('get', (b) => b.get(key, options)),
      head: (key: string) => use('head', (b) => b.head(key)),
      delete: (keys: string | string[]) => use('delete', (b) => b.delete(keys)),
    }
  }),
}) {}
