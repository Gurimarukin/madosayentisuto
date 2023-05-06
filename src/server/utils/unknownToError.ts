import { utilInspect } from './utilInspect'

export const unknownToError = (e: unknown): Error =>
  e instanceof Error ? e : new UnknownError(utilInspect(e, { breakLength: Infinity }))

// eslint-disable-next-line functional/no-class
class UnknownError extends Error {}
