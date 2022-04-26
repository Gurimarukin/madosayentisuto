import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { Future, IO } from '../shared/utils/fp'

import { Config } from './Config'
import { Context } from './Context'
import { LoggerObservable } from './models/logger/LoggerObservable'
import { ConsoleLogObserver } from './models/logger/observers/ConsoleLogObserver'
import { UserService } from './services/UserService'

const main: Future<void> = pipe(
  apply.sequenceS(IO.ApplyPar)({
    config: Config.load,
    loggerObservable: LoggerObservable.initAndSubscribe(['debug', ConsoleLogObserver]),
  }),
  Future.fromIOEither,
  Future.chain(({ config, loggerObservable }) => Context.load(config, loggerObservable)),
  Future.chain(
    ({ loggerObservable: { Logger }, userPersistence, jwtHelper }) =>
      UserService(Logger, userPersistence, jwtHelper).createUser,
  ),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
