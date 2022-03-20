import type { Parser } from 'fp-ts-routing'

import type { Method } from '../../../shared/models/Method'
import type { Tuple } from '../../../shared/utils/fp'

import type { EndedMiddleware } from './MyMiddleware'

export type Route = Tuple<Method, Parser<EndedMiddleware>>
