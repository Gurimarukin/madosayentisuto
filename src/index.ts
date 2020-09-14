import { Application } from './Application'
import { Config } from './config/Config'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { Do, Future, pipe } from './utils/fp'
import { MongoPoolParty } from './utils/MongoPoolParty'

pipe(
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('client', ({ config }) => DiscordConnector.futureClient(config))
    .letL('discord', ({ client }) => DiscordConnector(client))
    .letL('Logger', ({ config, discord }) => PartialLogger(config, discord))
    .bindL('mongo', ({ Logger, config }) => MongoPoolParty(Logger, config))
    .doL(({ Logger, config, discord, mongo }) => Application(Logger, config, discord, mongo))
    .return(() => {}),
  Future.runUnsafe
)
