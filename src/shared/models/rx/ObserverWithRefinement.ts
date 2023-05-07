import { refinement as refinement_ } from 'fp-ts'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'

import type { UnionDescription, UnionKeys, UnionResult, UnionTypes } from '../../utils/createUnion'
import { List, NonEmptyArray } from '../../utils/fp'
import type { TObserver } from './TObserver'

export type ObserverWithRefinement<A, B extends A> = {
  observer: TObserver<B>
  refinement: Refinement<A, B>
}

function of<A>(observer: TObserver<A>): ObserverWithRefinement<A, A>
function of<A, B extends A>(
  observer: TObserver<B>,
  refinement: Refinement<A, B>,
): ObserverWithRefinement<A, A>
function of<A, B extends A>(
  observer: TObserver<B>,
  refinement = refinement_.id() as Refinement<A, B>,
): ObserverWithRefinement<A, B> {
  return { observer, refinement }
}

const fromNext =
  <D extends UnionDescription, K extends NonEmptyArray<UnionKeys<UnionResult<D>>>>(
    u: UnionResult<D>,
    ...keys: K
  ) =>
  (
    next: TObserver<UnionTypes<UnionResult<D>, K[number]>>['next'],
  ): ObserverWithRefinement<UnionTypes<UnionResult<D>>, UnionTypes<UnionResult<D>, K[number]>> =>
    of({ next }, unionOr(u, keys))

export const ObserverWithRefinement = { of, fromNext }

const unionOr = <D extends UnionDescription, K extends NonEmptyArray<UnionKeys<UnionResult<D>>>>(
  u: UnionResult<D>,
  keys: K,
): Refinement<UnionTypes<UnionResult<D>>, UnionTypes<UnionResult<D>, K[number]>> => {
  type Res = Refinement<UnionTypes<UnionResult<D>>, UnionTypes<UnionResult<D>, K[number]>>

  return pipe(NonEmptyArray.unprepend(keys), ([head, tail]) =>
    pipe(
      tail,
      List.reduce(u.is(head) as Res, (acc, k) => pipe(acc, refinement_.or(u.is(k) as Res))),
    ),
  )
}
