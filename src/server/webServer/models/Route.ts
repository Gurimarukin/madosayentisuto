import type { Parser } from 'fp-ts-routing'

import type { Method } from '../../../shared/models/Method'
import { createUnion } from '../../../shared/utils/createUnion'
import type { Tuple } from '../../../shared/utils/fp'

import type { EndedMiddleware } from './MyMiddleware'
import type { UpgradeHandler } from './UpgradeHandler'

const u = createUnion({
  Middleware: (middleware: Tuple<Method, Parser<EndedMiddleware>>) => ({ middleware }),
  Upgrade: (upgrade: Parser<UpgradeHandler>) => ({ upgrade }),
})

export type Route = typeof u.T

export type RouteMiddleware = typeof u.Middleware.T
export type RouteUpgrade = typeof u.Upgrade.T

export const Route = {
  Middleware: u.Middleware,
  Upgrade: u.Upgrade,
  is: u.is,
}
