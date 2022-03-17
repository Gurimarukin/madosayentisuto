import type { Dict } from '../utils/fp'

export type EnforceNonEmptyDict<A extends Dict<string, unknown>> = keyof A extends never ? never : A
