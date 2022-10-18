import type { io } from 'fp-ts'

export type Store<A> = {
  readonly get: io.IO<A>
  readonly set: <B extends A>(newState: B) => io.IO<B>
  readonly modify: <B extends A>(f: (oldState: A) => B) => io.IO<B>
}

export const Store = <A>(init: A): Store<A> => {
  // eslint-disable-next-line functional/no-let
  let state = init

  const modify =
    <B extends A>(f: (s: A) => B): io.IO<B> =>
    () =>
      (state = f(state))

  return {
    get: () => state,
    set: newState => modify(() => newState),
    modify,
  }
}
