import { Schema } from 'effect'

// HTTP-shaped failures. Routes and services yield these; `http.ts` maps them
// to responses. Anything not listed here is a defect (a bug) and becomes 500.

export class BadRequest extends Schema.TaggedError<BadRequest>()('BadRequest', {
  message: Schema.String,
}) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()('Unauthorized', {
  message: Schema.String,
}) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()('Forbidden', {
  message: Schema.String,
}) {}

export class NotFound extends Schema.TaggedError<NotFound>()('NotFound', {
  message: Schema.String,
}) {}

export class Conflict extends Schema.TaggedError<Conflict>()('Conflict', {
  message: Schema.String,
}) {}

export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()('PayloadTooLarge', {
  message: Schema.String,
}) {}

export class StorageError extends Schema.TaggedError<StorageError>()('StorageError', {
  op: Schema.String,
  cause: Schema.Defect,
}) {}

export type HttpFailure =
  | BadRequest
  | Unauthorized
  | Forbidden
  | NotFound
  | Conflict
  | PayloadTooLarge
