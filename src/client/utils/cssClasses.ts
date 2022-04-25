import { pipe } from 'fp-ts/function'

import type { Tuple } from '../../shared/utils/fp'
import { List, Maybe } from '../../shared/utils/fp'

export const cssClasses = (
  ...classes: List<string | undefined | Tuple<string | undefined, boolean>>
): string | undefined =>
  pipe(
    classes,
    List.filterMap((args): Maybe<string> => {
      if (args === undefined) return Maybe.none
      if (typeof args === 'string') return Maybe.some(args)

      const [className, display] = args
      return display && className !== undefined ? Maybe.some(className) : Maybe.none
    }),
    Maybe.fromPredicate(List.isNonEmpty),
    Maybe.map(List.mkString(' ')),
    Maybe.toUndefined,
  )
