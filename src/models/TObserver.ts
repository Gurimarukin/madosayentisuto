import { Future } from '../utils/fp'

export type TObserver<A> =
  | {
      readonly next: (value: A) => Future<void>
      readonly error?: (err: unknown) => Future<void>
      readonly complete?: () => Future<void>
    }
  | {
      readonly next?: (value: A) => Future<void>
      readonly error: (err: unknown) => Future<void>
      readonly complete?: () => Future<void>
    }
  | {
      readonly next?: (value: A) => Future<void>
      readonly error?: (err: unknown) => Future<void>
      readonly complete: () => Future<void>
    }
