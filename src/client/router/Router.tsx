import { Route, end, parse, zero } from 'fp-ts-routing'
import React, { useEffect } from 'react'

import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { Home } from '../home/Home'

type TitleWithElement = Tuple<Maybe<string>, JSX.Element>

type Props = {
  readonly path: string
}

export function Router({ path }: Props): JSX.Element {
  const [subTitle, node] = route(path)
  const title = ['Jean Plank Bot', ...Maybe.toArray(subTitle)].join(' | ')

  useEffect(() => {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statement
    document.title = title
  }, [title])

  return node
}

const homeMatch = end

const routes = zero<TitleWithElement>().alt(
  homeMatch.parser.map(() => Tuple.of(Maybe.none, <Home />)),
)

const route = (path: string): TitleWithElement =>
  parse(routes, Route.parse(path), Tuple.of(Maybe.some('Page non trouvée'), <NotFound />))

const NotFound = (): JSX.Element => <div>Cette page n'existe pas.</div>
