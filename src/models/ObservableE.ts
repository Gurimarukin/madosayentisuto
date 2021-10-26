import * as O from 'fp-ts-rxjs/lib/Observable'
import * as OE from 'fp-ts-rxjs/lib/ObservableEither'
import { flow } from 'fp-ts/function'
import { Predicate } from 'fp-ts/Predicate'
import { Refinement } from 'fp-ts/Refinement'
import { Observable } from 'rxjs'

import { Either, Maybe, Try } from '../utils/fp'

export type ObservableE<A> = Observable<Try<A>>

export const ObservableE = {
  ...OE,
  filter,
  filterMap,
}

function filter<A, B extends A>(
  refinement: Refinement<A, B>,
): (obs: ObservableE<A>) => ObservableE<B>
function filter<A>(predicate: Predicate<A>): (obs: ObservableE<A>) => ObservableE<A>
function filter<A>(predicate: Predicate<A>): (obs: ObservableE<A>) => ObservableE<A> {
  return O.filter(Either.exists(predicate))
}

function filterMap<A, B>(f: (a: A) => Maybe<B>): (fa: ObservableE<A>) => ObservableE<B> {
  return O.filterMap(
    Either.fold<Error, A, Maybe<Try<B>>>(
      flow(Either.left, Maybe.some),
      flow(f, Maybe.map(Either.right)),
    ),
  )
}
