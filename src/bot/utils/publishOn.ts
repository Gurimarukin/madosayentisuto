import { pipe } from 'fp-ts/function'

import type { Dict, List } from '../../shared/utils/fp'
import { IO } from '../../shared/utils/fp'

/* eslint-disable functional/no-return-void */
type EventListenable<Keys extends string, Events extends Dict<Keys, List<unknown>>> = <
  K extends Keys,
>(
  event: K,
  listener: (...args: Events[K]) => void,
) => void
/* eslint-enable functional/no-return-void */

export const publishOn =
  <Keys extends string, Events extends Dict<Keys, List<unknown>>, A>(
    listenable: EventListenable<Keys, Events>,
    dispatch: (a: A) => IO<void>,
  ) =>
  <K extends Keys>(event: K, transformer: (...args: Events[K]) => A): IO<void> =>
    IO.tryCatch(() =>
      listenable(event, (...args) => pipe(dispatch(transformer(...args)), IO.runUnsafe)),
    )
