import { flow, pipe } from 'fp-ts/function'

import { loadDotEnv } from '../shared/utils/config/loadDotEnv'
import { Future, IO } from '../shared/utils/fp'

import { Config } from './config/Config'

const main: Future<void> = pipe(
  loadDotEnv,
  IO.chain(flow(Config.parse, IO.fromEither)),
  Future.fromIOEither,
  Future.map(() => {}),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
