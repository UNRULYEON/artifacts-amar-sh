import { Schema } from 'effect'

export const FileName = Schema.Trim.pipe(
  Schema.minLength(1),
  Schema.maxLength(255),
  Schema.pattern(/^[^/\\\0]+$/, { message: () => 'name must be a file name, not a path' }),
)
