import { apply, chain as fpTsChain, optionT } from 'fp-ts'
import type { Apply1 } from 'fp-ts/Apply'
import type { Chain1 } from 'fp-ts/Chain'
import type { Functor1 } from 'fp-ts/Functor'
import type { Lazy } from 'fp-ts/function'
import { flow, identity, pipe } from 'fp-ts/function'

import type { IO } from './fp'
import { Future, Maybe } from './fp'

const URI = 'TaskEitherOption' as const
type URI = typeof URI

declare module 'fp-ts/HKT' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface URItoKind<A> {
    readonly [URI]: Future<Maybe<A>>
  }
}

const some: <A>(a: A) => Future<Maybe<A>> = optionT.some(Future.Pointed)

const apPar_: Apply1<URI>['ap'] = (fab, fa) => pipe(fab, ap(fa))
const chain_: Chain1<URI>['chain'] = (ma, f) => pipe(ma, chain(f))
const map_: Functor1<URI>['map'] = (fa, f) => pipe(fa, map(f))

// eslint-disable-next-line @typescript-eslint/ban-types
const Do: Future<Maybe<{}>> = some({})

const ApplyPar: Apply1<URI> = {
  URI,
  map: map_,
  ap: apPar_,
}

const Chain: Chain1<URI> = {
  URI,
  map: map_,
  ap: apPar_,
  chain: chain_,
}

const Functor: Functor1<URI> = {
  URI,
  map: map_,
}

const ap = optionT.ap(Future.ApplyPar)

const chain = optionT.chain(Future.Monad)

const chainFirst = fpTsChain.chainFirst(Chain)

const chainFuture = <A, B>(f: (a: A) => Future<B>): ((fa: Future<Maybe<A>>) => Future<Maybe<B>>) =>
  chain(flow(f, Future.map(Maybe.some)))

const chainFirstFuture = <A, B>(
  f: (a: A) => Future<B>,
): ((fa: Future<Maybe<A>>) => Future<Maybe<A>>) => chainFirst(flow(f, Future.map(Maybe.some)))

const chainOption: <A, B>(f: (a: A) => Maybe<B>) => (fa: Future<Maybe<A>>) => Future<Maybe<B>> =
  optionT.chainOptionK(Future.Monad)

const fromFuture: <A>(fa: Future<A>) => Future<Maybe<A>> = optionT.fromF(Future.Functor)

const fromNullable: <A>(a: A) => Future<Maybe<NonNullable<A>>> = optionT.fromNullable(
  Future.Pointed,
)

const fromOption: <A>(a: Maybe<A>) => Future<Maybe<A>> = optionT.fromOptionK(Future.Pointed)(
  identity,
)

const fromIOEither: <A>(fa: IO<A>) => Future<Maybe<A>> = flow(
  Future.fromIOEither,
  Future.map(Maybe.some),
)

type GetOrElse = <A>(onNone: Lazy<Future<A>>) => (fa: Future<Maybe<A>>) => Future<A>
const getOrElse: GetOrElse = optionT.getOrElse(Future.Monad)

const map = optionT.map(Future.Functor)

const none: Future<Maybe<never>> = optionT.zero(Future.Pointed)()

export const futureMaybe = {
  Do,
  ApplyPar,
  Functor,
  alt: optionT.alt(Future.Monad),
  apS: apply.apS(ApplyPar),
  bind: fpTsChain.bind(Chain),
  chain,
  chainFirst,
  chainFuture,
  chainFirstFuture,
  chainOption,
  fromFuture,
  fromNullable,
  fromOption,
  fromIOEither,
  getOrElse,
  map,
  match: optionT.match(Future.Functor),
  matchE: optionT.matchE(Future.Chain),
  none,
  some,
}