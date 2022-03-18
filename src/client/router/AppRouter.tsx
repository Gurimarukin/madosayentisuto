import { end, format, lit, str } from 'fp-ts-routing'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { RouterUtils } from '../../shared/utils/RouterUtils'

const { codec } = RouterUtils

/**
 * matches
 */
const guildMatch = lit('guild').then(codec('guildId')<GuildId>(str))
const guildEmojisMatch = guildMatch.then(lit('emojis'))

/**
 * parser
 */
export const appParsers = {
  index: end.parser,
  guild: {
    index: guildMatch.then(end).parser,
    emojis: guildEmojisMatch.then(end).parser,
  },
}

/**
 * routes
 */
export const appRoutes = {
  index: format(end.formatter, {}),
  guild: {
    index: (guildId: GuildId) => format(guildMatch.formatter, { guildId }),
    emojis: (guildId: GuildId) => format(guildEmojisMatch.formatter, { guildId }),
  },
}
