import type { Parser } from 'fp-ts-routing'

import type { ParserWithMethod } from '../../shared/ApiRouter'
import { apiParsers as api } from '../../shared/ApiRouter'
import { MsDuration } from '../../shared/models/MsDuration'
import type { List } from '../../shared/utils/fp'

import type { DiscordClientController } from '../controllers/DiscordClientController'
import type { HealthCheckController } from '../controllers/HealthCheckController'
import type { LogController } from '../controllers/LogController'
import type { MemberController } from '../controllers/MemberController'
import type { ScheduledEventController } from '../controllers/ScheduledEventController'
import type { UserController } from '../controllers/UserController'
import type { EndedMiddleware } from './models/MyMiddleware'
import type { RouteMiddleware, RouteUpgrade } from './models/Route'
import { Route } from './models/Route'
import type { UpgradeHandler } from './models/UpgradeHandler'
import type { RateLimiter } from './utils/RateLimiter'
import type { WithAuth } from './utils/WithAuth'

export const Routes = (
  rateLimiter: RateLimiter,
  withAuth_: WithAuth,
  discordClientController: DiscordClientController,
  healthCheckController: HealthCheckController,
  logController: LogController,
  memberController: MemberController,
  scheduledEventController: ScheduledEventController,
  userController: UserController,
): List<Route> => {
  const { middleware: withAuth, upgrade: withAuthUpgrade } = withAuth_

  return [
    m(api.healthcheck.get, () => healthCheckController.check),

    m(api.login.post, () => rateLimiter(2, MsDuration.minutes(1))(userController.login)),

    m(api.guilds.get, () => withAuth(discordClientController.listGuilds)),
    m(api.guild.get, ({ guildId }) => withAuth(discordClientController.findGuild(guildId))),

    m(api.member.birthdate.post, ({ userId }) =>
      withAuth(memberController.updateMemberBirthdate(userId)),
    ),
    m(api.member.birthdate.del3te, ({ userId }) =>
      withAuth(memberController.deleteMemberBirthdate(userId)),
    ),

    m(api.scheduledEvents.get, () => withAuth(scheduledEventController.listScheduledEvents)),

    m(api.logs.get, () => withAuth(logController.listLogs)),
    u(api.ws, () => withAuthUpgrade(logController.webSocket)),
  ]
}

const m = <A>(
  [parser, method]: ParserWithMethod<A>,
  f: (a: A) => EndedMiddleware,
): RouteMiddleware => Route.Middleware([method, parser.map(f)])

const u = <A>(parser: Parser<A>, f: (a: A) => UpgradeHandler): RouteUpgrade =>
  Route.Upgrade(parser.map(f))
