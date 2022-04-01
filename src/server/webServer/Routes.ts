import type { ParserWithMethod } from '../../shared/ApiRouter'
import { apiParsers as api } from '../../shared/ApiRouter'
import type { List } from '../../shared/utils/fp'

import type { DiscordClientController } from './controllers/DiscordClientController'
import type { HealthCheckController } from './controllers/HealthCheckController'
import type { UserController } from './controllers/UserController'
import type { EndedMiddleware } from './models/MyMiddleware'
import type { Route } from './models/Route'
import type { WithAuth } from './utils/WithAuth'

export const Routes = (
  withAuth: WithAuth,
  healthCheckController: HealthCheckController,
  userController: UserController,
  discordClientController: DiscordClientController,
): List<Route> => [
  r(api.healthcheck.get, () => healthCheckController.check),

  r(api.login.post, () => userController.login),

  r(api.guilds.get, () => withAuth(discordClientController.listGuilds)),
  r(api.guild.get, ({ guildId }) => withAuth(discordClientController.findGuild(guildId))),

  r(api.member.birthdate.post, ({ userId }) =>
    withAuth(discordClientController.updateMemberBirthdate(userId)),
  ),
  r(api.member.birthdate.del3te, ({ userId }) =>
    withAuth(discordClientController.deleteMemberBirthdate(userId)),
  ),
]

// get Route
function r<A>([parser, method]: ParserWithMethod<A>, f: (a: A) => EndedMiddleware): Route {
  return [method, parser.map(f)]
}
