import type { MethodWithParser } from '../../shared/ApiRouter'
import { apiParsers } from '../../shared/ApiRouter'
import type { List } from '../../shared/utils/fp'

import type { EndedMiddleware } from '../webServer/models/EndedMiddleware'
import type { DiscordClientController } from './controllers/DiscordClientController'
import type { HealthCheckController } from './controllers/HealthCheckController'
import type { WithAuth } from './controllers/WithAuth'
import type { Route } from './models/Route'

const { get } = apiParsers

export const Routes = (
  withAuth: WithAuth,
  healthCheckController: HealthCheckController,
  discordClientController: DiscordClientController,
): List<Route> => [
  r(get.api.healthcheck, () => healthCheckController.check),

  r(get.api.guilds, () => withAuth(discordClientController.guilds)),
  r(get.api.guild, ({ guildId }) => withAuth(discordClientController.guild(guildId))),
]

// get Route
function r<A>([method, parser]: MethodWithParser<A>, f: (a: A) => EndedMiddleware): Route {
  return [method, parser.map(f)]
}
