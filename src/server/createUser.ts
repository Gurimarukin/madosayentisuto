import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { LogUtils } from '../shared/utils/LogUtils'
import type { NotUsed } from '../shared/utils/fp'
import { Future, IO } from '../shared/utils/fp'

import { Context } from './Context'
import { Config } from './config/Config'
import { LoggerObservable } from './models/logger/LoggerObservable'
import { ConsoleLogObserver } from './models/logger/observers/ConsoleLogObserver'
import { UserService } from './services/UserService'

const main: Future<NotUsed> = pipe(
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
Future.run(LogUtils.onErrorConsole)(main)
