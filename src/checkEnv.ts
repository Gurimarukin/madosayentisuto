import { Config } from 'bot/Config'
import { pipe } from 'fp-ts/function'
import { Future } from 'shared/utils/fp'

const main: Future<void> = pipe(
  // check config
  Config.load(),
  Future.fromIOEither,
  Future.map(() => {}),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
