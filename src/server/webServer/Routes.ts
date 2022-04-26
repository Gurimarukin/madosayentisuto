import type { ParserWithMethod } from '../../shared/ApiRouter'
import { apiParsers as api } from '../../shared/ApiRouter'
import type { List } from '../../shared/utils/fp'

import type { DiscordClientController } from './controllers/DiscordClientController'
import type { HealthCheckController } from './controllers/HealthCheckController'
import type { LogController } from './controllers/LogController'
import type { MemberController } from './controllers/MemberController'
import type { ScheduledEventController } from './controllers/ScheduledEventController'
import type { UserController } from './controllers/UserController'
import type { EndedMiddleware } from './models/MyMiddleware'
import type { Route } from './models/Route'
import type { WithAuth } from './utils/WithAuth'

export const Routes = (
  withAuth: WithAuth,
  discordClientController: DiscordClientController,
  healthCheckController: HealthCheckController,
  logController: LogController,
  memberController: MemberController,
  scheduledEventController: ScheduledEventController,
  userController: UserController,
): List<Route> => [
  r(api.healthcheck.get, () => healthCheckController.check),

  r(api.login.post, () => userController.login),

  r(api.guilds.get, () => withAuth(discordClientController.listGuilds)),
  r(api.guild.get, ({ guildId }) => withAuth(discordClientController.findGuild(guildId))),

  r(api.member.birthdate.post, ({ userId }) =>
    withAuth(memberController.updateMemberBirthdate(userId)),
  ),
  r(api.member.birthdate.del3te, ({ userId }) =>
    withAuth(memberController.deleteMemberBirthdate(userId)),
  ),

  r(api.scheduledEvents.get, () => withAuth(scheduledEventController.listScheduledEvents)),

  r(api.logs.get, () => withAuth(logController.listLogs)),
]

// get Route
function r<A>([parser, method]: ParserWithMethod<A>, f: (a: A) => EndedMiddleware): Route {
  return [method, parser.map(f)]
}
