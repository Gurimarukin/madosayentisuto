import type { List } from '../../shared/utils/fp'

import type { Route } from '../models/Route'

export const Routes = (): List<Route> => [
  // ['get', '/api/healthcheck', healthCheckController.index],
  // ['get', '/api/klk-posts', klkPostController.klkPosts],
  // ['post', '/api/klk-posts/:id', withParams(postId)(klkPostController.klkPostEdit)],
  // ['post', '/api/login', rateLimiter(2, MsDuration.minutes(1))(userController.login)],
]
