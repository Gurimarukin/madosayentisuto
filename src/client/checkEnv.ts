import { flow, pipe } from 'fp-ts/function'

import { loadDotEnv } from '../shared/utils/config/loadDotEnv'
import type { NotUsed } from '../shared/utils/fp'
import { Future, IO, toNotUsed } from '../shared/utils/fp'

import { Config } from './config/Config'

const main: Future<NotUsed> = pipe(
  loadDotEnv,
  IO.chain(flow(Config.parse, IO.fromEither)),
  Future.fromIOEither,
  Future.map(toNotUsed),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
