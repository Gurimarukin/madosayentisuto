import { pipe } from 'fp-ts/function'

import { Future } from '../shared/utils/fp'

import { Application } from './Application'
import { Config } from './Config'
import { Context } from './Context'
import { DiscordConnector } from './helpers/DiscordConnector'
import { LoggerObservable } from './models/logger/LoggerObservable'
import { ConsoleLogObserver } from './models/logger/observers/ConsoleLogObserver'
import { DiscordDMLogObserver } from './models/logger/observers/DiscordDMLogObserver'

const main: Future<void> = pipe(
  Future.Do,
  Future.apS('config', Future.fromIOEither(Config.load)),
  Future.bind('discord', ({ config }) => DiscordConnector.fromConfig(config.client)),
  Future.bind('loggerObservable', ({ config, discord }) =>
    Future.fromIOEither(
      LoggerObservable.initAndSubscribe(
        [config.logger.consoleLevel, ConsoleLogObserver],
        [
          config.logger.discordDM.level,
          DiscordDMLogObserver(
            config.admins,
            { discordDMIsCompact: config.logger.discordDM.isCompact },
            discord,
          ),
        ],
      ),
    ),
  ),
  Future.bind('context', ({ config, loggerObservable }) => Context.load(config, loggerObservable)),
  Future.chainIOEitherK(({ discord, context }) => Application(discord, context)),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
