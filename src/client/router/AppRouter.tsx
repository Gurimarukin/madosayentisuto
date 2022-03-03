import { end, format, lit, str } from 'fp-ts-routing'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { RouterUtils } from '../../shared/utils/RouterUtils'

const { codec } = RouterUtils

/**
 * matches
 */
const guildMatch = lit('guild').then(codec('guildId')<GuildId>(str))

/**
 * parser
 */
export const appParsers = {
  home: end.parser,
  guild: guildMatch.parser,
}

/**
 * routes
 */
export const appRoutes = {
  home: format(end.formatter, {}),
  guild: (guildId: GuildId) => format(guildMatch.formatter, { guildId }),
}
