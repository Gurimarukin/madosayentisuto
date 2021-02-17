import { Application } from './Application'
import { Config } from './config/Config'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { Do, Future, pipe } from './utils/fp'

pipe(
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('client', ({ config }) => DiscordConnector.futureClient(config))
    .letL('discord', ({ client }) => DiscordConnector(client))
    .letL('Logger', ({ config, discord }) => PartialLogger(config, discord))
    .doL(({ Logger, config, discord }) => Application(Logger, config, discord))
    .return(() => {}),
  Future.runUnsafe,
)
