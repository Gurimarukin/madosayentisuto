import { format, lit, str } from 'fp-ts-routing'

import type { GuildId } from './models/guild/GuildId'
import { RouterUtils } from './utils/RouterUtils'

const { codec } = RouterUtils

/**
 * matches
 */
const api = lit('api')
const apiGuilds = api.then(lit('guilds'))
const apiGuild = api.then(lit('guild')).then(codec('guildId')<GuildId>(str))

export const apiMatches = {
  api: {
    guilds: apiGuilds,
    guild: apiGuild,
  },
}

/**
 * formats
 */
export const apiRoutes = {
  api: {
    guilds: format(apiGuilds.formatter, {}),
    guild: (guildId: GuildId) => format(apiGuild.formatter, { guildId }),
  },
}
