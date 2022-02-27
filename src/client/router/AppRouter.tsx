import { end, format, lit, str, zero } from 'fp-ts-routing'
import React from 'react'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { RouterUtils } from '../../shared/utils/RouterUtils'
import { Maybe } from '../../shared/utils/fp'
import { Tuple } from '../../shared/utils/fp'

import { GuildDetail } from '../guildDetail/GuildDetail'
import { Home } from '../home/Home'

const { codec } = RouterUtils

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
      Tuple.of(Maybe.some('Serveur'), <GuildDetail guildId={guildId} />),
    ),
  )

/**
 * routes
 */
export const appRoutes = {
  home: format(end.formatter, {}),
  guild: (guildId: GuildId) => format(guildMatch.formatter, { guildId }),
}
