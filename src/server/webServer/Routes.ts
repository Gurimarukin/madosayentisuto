import type { MethodWithParser } from '../../shared/ApiRouter'
import { apiParsers } from '../../shared/ApiRouter'
import type { List } from '../../shared/utils/fp'

import type { DiscordClientController } from './controllers/DiscordClientController'
import type { HealthCheckController } from './controllers/HealthCheckController'
import type { EndedMiddleware } from './models/MyMiddleware'
import type { Route } from './models/Route'
import type { WithAuth } from './utils/WithAuth'

const { get, post, delete_ } = apiParsers

export const Routes = (
  withAuth: WithAuth,
  healthCheckController: HealthCheckController,
  discordClientController: DiscordClientController,
): List<Route> => [
  r(get.api.healthcheck, () => healthCheckController.check),

  r(get.api.guilds, () => withAuth(discordClientController.listGuilds)),
  r(get.api.guild, ({ guildId }) => withAuth(discordClientController.findGuild(guildId))),

  r(post.api.member.birthdate, ({ userId }) =>
    withAuth(discordClientController.updateMemberBirthdate(userId)),
  ),
  r(delete_.api.member.birthdate, ({ userId }) =>
    withAuth(discordClientController.deleteMemberBirthdate(userId)),
  ),
]

// get Route
function r<A>([method, parser]: MethodWithParser<A>, f: (a: A) => EndedMiddleware): Route {
  return [method, parser.map(f)]
}
