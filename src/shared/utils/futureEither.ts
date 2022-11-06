import { apply, eitherT, chain as fpTsChain, functor } from 'fp-ts'
import type { Apply2 } from 'fp-ts/Apply'
import type { Chain2 } from 'fp-ts/Chain'
import type { Functor2 } from 'fp-ts/Functor'
import type { Predicate } from 'fp-ts/Predicate'
import type { Refinement } from 'fp-ts/Refinement'
import { flow, pipe } from 'fp-ts/function'

import { Either, Future } from './fp'

const URI = 'TaskEitherEither' as const
type URI = typeof URI

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface URItoKind2<E, A> {
    readonly [URI]: Future<Either<E, A>>
  }
}

const right: <A, E = never>(a: A) => Future<Either<E, A>> = eitherT.right(Future.Pointed)
const left: <E, A = never>(e: E) => Future<Either<E, A>> = eitherT.left(Future.Pointed)

const apPar_: Apply2<URI>['ap'] = (fab, fa) => pipe(fab, ap(fa))
const chain_: Chain2<URI>['chain'] = (ma, f) => pipe(ma, chain(f))
const map_: Functor2<URI>['map'] = (fa, f) => pipe(fa, map(f))

// eslint-disable-next-line @typescript-eslint/ban-types
const Do: Future<Either<never, {}>> = right({})

const ApplyPar: Apply2<URI> = {
  URI,
  map: map_,
  ap: apPar_,
}

const Chain: Chain2<URI> = {
  URI,
  map: map_,
  ap: apPar_,
  chain: chain_,
}

const Functor: Functor2<URI> = {
  URI,
  map: map_,
}

const ap = eitherT.ap(Future.ApplyPar)

const chain = eitherT.chain(Future.Monad)

const chainTaskEitherK = <A, B>(
  f: (a: A) => Future<B>,
): (<E>(fa: Future<Either<E, A>>) => Future<Either<E, B>>) =>
  chain(
    flow(
      f,
      Future.map(b => Either.right(b)),
    ),
  )

type FilterOrElse = {
  <A, B extends A, E>(refinement: Refinement<A, B>, onFalse: (a: A) => E): (
    ma: Future<Either<E, A>>,
  ) => Future<Either<E, B>>
  <A_1, E_1>(predicate: Predicate<A_1>, onFalse: (a: A_1) => E_1): <B_1 extends A_1>(
    mb: Future<Either<E_1, B_1>>,
  ) => Future<Either<E_1, B_1>>
  <A_2, E_2>(predicate: Predicate<A_2>, onFalse: (a: A_2) => E_2): (
    ma: Future<Either<E_2, A_2>>,
  ) => Future<Either<E_2, A_2>>
}

const filterOrElse = flow(Either.filterOrElse, Future.map) as FilterOrElse

const map = eitherT.map(Future.Functor)

export const futureEither = {
  Do,
  ap,
  apS: apply.apS(ApplyPar),
  bind: fpTsChain.bind(Chain),
  bindTo: functor.bindTo(Functor),
  chain,
  chainTaskEitherK,
  filterOrElse,
  left,
  map,
  right,
}
