import { Lazy } from 'fp-ts/lib/function'

export function unknownToError(e: unknown): Error {
  return e instanceof Error ? e : new Error('unknown error')
}

export function io<A>(f: Lazy<A>): IO<A> {
  return IO.tryCatch(f, unknownToError)
}
