import type { Encoder } from 'io-ts/Encoder'

export const jsonStringify =
  <O, A>(encoder: Encoder<O, A>) =>
  (a: A): string =>
    JSON.stringify(encoder.encode(a))
