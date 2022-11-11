import type { Match, Parser } from 'fp-ts-routing'
import { end, format, lit, str } from 'fp-ts-routing'

import type { DiscordUserId } from './models/DiscordUserId'
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
const apiLogin = api.then(lit('login'))
const apiGuilds = api.then(lit('guilds'))
const apiGuild = api.then(lit('guild')).then(codec('guildId')<GuildId>(str))
const apiMember = api.then(lit('member')).then(codec('userId')<DiscordUserId>(str))
const apiMemberBirthdate = apiMember.then(lit('birthdate'))
const apiScheduledEvents = api.then(lit('scheduledEvents'))
const apiLogs = api.then(lit('logs'))
const apiWs = api.then(lit('ws'))

// final
const healthcheckGet = m(apiHealthcheck, 'get')

const loginPost = m(apiLogin, 'post')

const guildsGet = m(apiGuilds, 'get')
const guildGet = m(apiGuild, 'get')

const memberBirthdatePost = m(apiMemberBirthdate, 'post')
const memberBirthdateDelete = m(apiMemberBirthdate, 'delete')

const scheduledEventsGet = m(apiScheduledEvents, 'get')

const logsGet = m(apiLogs, 'get')

/**
 * parsers
 */

export const apiParsers = {
  healthcheck: { get: p(healthcheckGet) },
  login: { post: p(loginPost) },
  guilds: { get: p(guildsGet) },
  guild: { get: p(guildGet) },
  member: {
    birthdate: {
      post: p(memberBirthdatePost),
      del3te: p(memberBirthdateDelete),
    },
  },
  scheduledEvents: { get: p(scheduledEventsGet) },
  logs: { get: p(logsGet) },
  ws: apiWs.then(end).parser,
}

/**
 * formats
 */

export const apiRoutes = {
  login: { post: r(loginPost, {}) },
  guilds: { get: r(guildsGet, {}) },
  guild: { get: (guildId: GuildId) => r(guildGet, { guildId }) },
  member: {
    birthdate: {
      post: (userId: DiscordUserId) => r(memberBirthdatePost, { userId }),
      del3te: (userId: DiscordUserId) => r(memberBirthdateDelete, { userId }),
    },
  },
  scheduledEvents: { get: r(scheduledEventsGet, {}) },
  logs: { get: r(logsGet, {}) },
  ws: format(apiWs.formatter, {}),
}

/**
 * Helpers
 */

type WithMethod<A> = Tuple<A, Method>
type MatchWithMethod<A> = WithMethod<Match<A>>
export type ParserWithMethod<A> = WithMethod<Parser<A>>
type RouteWithMethod = WithMethod<string>

// Match with Method
function m<A>(match: Match<A>, method: Method): MatchWithMethod<A> {
  return [match.then(end), method]
}

// Parser with Method
function p<A>([match, method]: MatchWithMethod<A>): ParserWithMethod<A> {
  return [match.parser, method]
}

// Route with Method
function r<A>([match, method]: MatchWithMethod<A>, a: A): RouteWithMethod {
  return [format(match.formatter, a), method]
}
