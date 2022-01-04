import { end, format, zero } from 'fp-ts-routing'
import React from 'react'

import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { Home } from '../home/Home'

type TitleWithElement = Tuple<Maybe<string>, JSX.Element>

/**
 * matches
 */

/**
 * parser
 */
const parser = zero<TitleWithElement>().alt(end.parser.map(() => Tuple.of(Maybe.none, <Home />)))

/**
 * routes
 */
const routes = {
  home: format(end.formatter, {}),
}

export const AppRouter = { parser, routes }
