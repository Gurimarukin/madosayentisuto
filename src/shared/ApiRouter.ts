import type { Match, Parser } from 'fp-ts-routing'
import { end } from 'fp-ts-routing'
import { format, lit, str } from 'fp-ts-routing'

import type { Method } from './models/Method'
import type { GuildId } from './models/guild/GuildId'
import { RouterUtils } from './utils/RouterUtils'
import type { Tuple } from './utils/fp'

const { codec } = RouterUtils

/**
 * matches
 */

// intermediate
const api = lit('api')
const apiHealthcheck = api.then(lit('healthcheck'))
const apiGuilds = api.then(lit('guilds'))
const apiGuild = api.then(lit('guild')).then(codec('guildId')<GuildId>(str))

// final
const getApiHealthcheck = m('get', apiHealthcheck.then(end))
const getApiGuilds = m('get', apiGuilds.then(end))
const getApiGuild = m('get', apiGuild.then(end))

/**
 * parsers
 */
export const apiParsers = {
  get: {
    api: {
      healthcheck: p(getApiHealthcheck),
      guilds: p(getApiGuilds),
      guild: p(getApiGuild),
    },
  },
}

/**
 * formats
 */
export const apiRoutes = {
  get: {
    api: {
      guilds: r(getApiGuilds, {}),
      guild: (guildId: GuildId) => r(getApiGuild, { guildId }),
    },
  },
}

type MethodWith<A> = Tuple<Method, A>
type MethodWithMatch<A> = MethodWith<Match<A>>
export type MethodWithParser<A> = MethodWith<Parser<A>>
type MethodWithRoute = MethodWith<string>

// Match with Method
function m<A>(method: Method, match: Match<A>): MethodWithMatch<A> {
  return [method, match]
}

// Parser with Method
function p<A>([method, match]: MethodWithMatch<A>): MethodWithParser<A> {
  return [method, match.parser]
}

// Route with Method
function r<A>([method, match]: MethodWithMatch<A>, a: A): MethodWithRoute {
  return [method, format(match.formatter, a)]
}
