import type { Match } from 'fp-ts-routing'
import { end, format, lit, str, zero } from 'fp-ts-routing'
import type { AnyNewtype, CarrierOf } from 'newtype-ts'
import React from 'react'

import type { GuildId } from '../../shared/models/guild/GuildId'
import type { Dict } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { Home } from '../home/Home'

type TitleWithElement = Tuple<Maybe<string>, JSX.Element>

/**
 * matches
 */
const guildMatch = lit('guild').then(codec('guildId')<GuildId>(str))

/**
 * parser
 */
export const appRouterParser = zero<TitleWithElement>()
  .alt(end.parser.map(() => Tuple.of(Maybe.none, <Home />)))
  .alt(
    guildMatch.parser.map(({ guildId }) =>
      Tuple.of(Maybe.some('Serveur'), <div>Serveur {guildId}</div>),
    ),
  )

/**
 * routes
 */
export const appRoutes = {
  home: format(end.formatter, {}),
  guild: (guildId: GuildId) => format(guildMatch.formatter, { guildId }),
}

function codec<K extends string>(
  k: K,
): <N extends AnyNewtype = never>(
  match: (k_: K) => Match<Dict<K, CarrierOf<N>>>,
) => Match<Dict<K, N>> {
  return match => match(k)
}
