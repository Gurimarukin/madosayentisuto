import type { Endomorphism } from 'fp-ts/Endomorphism'

import { IO } from '../../shared/utils/fp'

export type Store<A> = {
  readonly get: IO<A>
  readonly set: (a: A) => IO<void>
  readonly update: (f: Endomorphism<A>) => IO<void>
}

export const Store = <A>(init: A): Store<A> => {
  // eslint-disable-next-line functional/no-let
  let value = init

  const update = (f: Endomorphism<A>): IO<void> =>
    IO.fromIO(() => {
      // eslint-disable-next-line functional/no-expression-statement
      value = f(value)
    })

  return {
    get: IO.fromIO(() => value),
    set: (a: A): IO<void> => update(() => a),
    update,
  }
}
