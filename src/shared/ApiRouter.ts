import { format, lit } from 'fp-ts-routing'

/**
 * matches
 */
const apiGuilds = lit('api').then(lit('guilds'))

export const apiMatches = {
  api: {
    guilds: apiGuilds,
  },
}

/**
 * formats
 */
export const apiRoutes = {
  api: {
    guilds: format(apiGuilds.formatter, {}),
  },
}
