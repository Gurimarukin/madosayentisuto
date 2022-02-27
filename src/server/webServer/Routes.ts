import type { MethodWithParser } from '../../shared/ApiRouter'
import { apiParsers } from '../../shared/ApiRouter'
import type { List } from '../../shared/utils/fp'

import type { EndedMiddleware } from '../webServer/models/EndedMiddleware'
import type { DiscordClientController } from './controllers/DiscordClientController'
import type { Route } from './models/Route'

const { get } = apiParsers

export const Routes = (discordClientController: DiscordClientController): List<Route> => [
  r(get.api.guilds, () => discordClientController.guilds),
  r(get.api.guild, ({ guildId }) => discordClientController.guild(guildId)),

  // ['get', '/api/healthcheck', healthCheckController.index],
  // ['get', '/api/klk-posts', klkPostController.klkPosts],
  // ['post', '/api/klk-posts/:id', withParams(postId)(klkPostController.klkPostEdit)],
  // ['post', '/api/login', rateLimiter(2, MsDuration.minutes(1))(userController.login)],
]

// get Route
function r<A>([method, parser]: MethodWithParser<A>, f: (a: A) => EndedMiddleware): Route {
  return [method, parser.map(f)]
}
