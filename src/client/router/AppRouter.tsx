import { end, format, lit, str } from 'fp-ts-routing'

import type { GuildId } from '../../shared/models/guild/GuildId'
import { RouterUtils } from '../../shared/utils/RouterUtils'

const { codec } = RouterUtils

/**
 * matches
 */

const loginMatch = lit('login')
const guildMatch = lit('guild').then(codec('guildId')<GuildId>(str))
const guildMembersMatch = guildMatch.then(lit('members'))
const guildEmojisMatch = guildMatch.then(lit('emojis'))
const scheduledEventsMatch = lit('scheduledEvents')

/**
 * parser
 */

// don't forget .then(end)
export const appParsers = {
  index: end.parser,
  login: loginMatch.then(end).parser,
  guild: {
    index: guildMatch.then(end).parser,
    members: guildMembersMatch.then(end).parser,
    emojis: guildEmojisMatch.then(end).parser,
  },
  scheduledEvents: scheduledEventsMatch.then(end).parser,
}

/**
 * routes
 */

export const appRoutes = {
  index: format(end.formatter, {}),
  login: format(loginMatch.formatter, {}),
  guild: {
    index: (guildId: GuildId) => format(guildMatch.formatter, { guildId }),
    members: (guildId: GuildId) => format(guildMembersMatch.formatter, { guildId }),
    emojis: (guildId: GuildId) => format(guildEmojisMatch.formatter, { guildId }),
  },
  scheduledEvents: format(scheduledEventsMatch.formatter, {}),
}
