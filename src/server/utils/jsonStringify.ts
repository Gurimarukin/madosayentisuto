import type * as E from 'io-ts/Encoder'

export const jsonStringify =
  <O, A>(encoder: E.Encoder<O, A>) =>
  (a: A): string =>
    JSON.stringify(encoder.encode(a))
