import { pipe } from 'fp-ts/function'

import { Future } from '../shared/utils/fp'

import { Application } from './Application'
import { Config } from './Config'
import { Context } from './Context'
import { DiscordConnector } from './helpers/DiscordConnector'
import { LoggerGetter } from './models/logger/LoggerGetter'
import { consoleLogFunction } from './models/logger/consoleLogFunction'
import { discordDMLogFunction } from './models/logger/discordDMLogFunction'

const main: Future<void> = pipe(
  Future.Do,
  Future.apS('config', Future.fromIOEither(Config.load)),
  Future.bind('discord', ({ config }) => DiscordConnector.fromConfig(config.client)),
  Future.bind('Logger', ({ config, discord }) =>
    Future.right(
      LoggerGetter.of(
        [config.logger.consoleLevel, consoleLogFunction],
        [
          config.logger.discordDM.level,
          discordDMLogFunction(
            config.admins,
            { discordDMIsCompact: config.logger.discordDM.isCompact },
            discord,
          ),
        ],
      ),
    ),
  ),
  Future.bind('context', ({ config, Logger }) => Context.load(config, Logger)),
  Future.chainIOEitherK(({ discord, context }) => Application(discord, context)),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
