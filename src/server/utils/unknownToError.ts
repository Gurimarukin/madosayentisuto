import util from 'util'

export const unknownToError = (e: unknown): Error =>
  e instanceof Error
    ? e
    : new Error(`unknown error: ${util.formatWithOptions({ breakLength: Infinity }, e)}`)
