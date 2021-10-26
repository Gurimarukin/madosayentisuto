import { IO } from '../utils/fp'

export type Subscriber<A> =
  | {
      readonly next: (value: A) => IO<void>
      readonly error?: (err: unknown) => IO<void>
      readonly complete?: () => IO<void>
    }
  | {
      readonly next?: (value: A) => IO<void>
      readonly error: (err: unknown) => IO<void>
      readonly complete?: () => IO<void>
    }
  | {
      readonly next?: (value: A) => IO<void>
      readonly error?: (err: unknown) => IO<void>
      readonly complete: () => IO<void>
    }