import { Route, parse } from 'fp-ts-routing'
import React, { useEffect, useMemo } from 'react'

import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { AppRouter } from './AppRouter'
import { useHistory } from './HistoryContext'

export const AppRouterComponent = (): JSX.Element => {
  const { location } = useHistory()

  const [title, node] = useMemo(() => {
    const [subTitle, node_] = parse(
      AppRouter.parser,
      Route.parse(location.pathname),
      Tuple.of(Maybe.some('Page non trouvée'), <NotFound />),
    )
    const title_ = ['Jean Plank Bot', ...Maybe.toArray(subTitle)].join(' | ')
    return [title_, node_]
  }, [location.pathname])

  useEffect(() => {
    // eslint-disable-next-line functional/immutable-data, functional/no-expression-statement
    document.title = title
  }, [title])

  return node
}

// TODO: move to own file?
const NotFound = (): JSX.Element => <div>Cette page n'existe pas.</div>
