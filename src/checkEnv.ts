import { pipe } from 'fp-ts/function'

import { Config } from './config/Config'
import { Future } from './utils/fp'

const main: Future<void> = pipe(
  // check config
  Config.load(),
  Future.fromIOEither,
  Future.map(() => {}),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
