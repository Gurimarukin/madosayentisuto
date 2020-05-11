import * as O from 'fp-ts-rxjs/lib/Observable'
import { Refinement, Predicate } from 'fp-ts/lib/function'
import { Observable, Subscriber } from 'rxjs'

import { Try, pipe, Either } from '../utils/fp'

export type ObservableE<A> = Observable<Try<A>>

export namespace ObservableE {
  export function filter<A, B extends A>(
    refinement: Refinement<A, B>
  ): (obs: ObservableE<A>) => ObservableE<B>
  export function filter<A>(predicate: Predicate<A>): (obs: ObservableE<A>) => ObservableE<A>
  export function filter<A>(predicate: Predicate<A>): (obs: ObservableE<A>) => ObservableE<A> {
    return obs => pipe(obs, O.filter(Either.exists(predicate)))
  }
}

export type SubscriberE<A> = Subscriber<Try<A>>
