import { pipe } from 'fp-ts/function'

import { Future } from '../shared/utils/fp'

import { Config } from './Config'
import { Context } from './Context'
import { LoggerGetter } from './models/logger/LoggerGetter'
import { consoleLogFunction } from './models/logger/consoleLogFunction'
import { UserService } from './services/UserService'

const main: Future<void> = pipe(
  Config.load,
  Future.fromIOEither,
  Future.chain(config => Context.load(config, LoggerGetter.of(['debug', consoleLogFunction]))),
  Future.chain(({ Logger, userPersistence, jwtHelper }) => {
    const userService = UserService(Logger, userPersistence, jwtHelper)
    return userService.createUser
  }),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
