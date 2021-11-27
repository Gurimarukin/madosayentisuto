import { IO } from '../../shared/utils/fp'

export type Store<A> = {
  readonly get: IO<A>
  readonly set: (a: A) => IO<void>
}

export const Store = <A>(init: A): Store<A> => {
  // eslint-disable-next-line functional/no-let
  let value = init
  return {
    get: IO.fromIO(() => value),
    set: (a: A) =>
      IO.fromIO(() => {
        // eslint-disable-next-line functional/no-expression-statement
        value = a
      }),
  }
}
