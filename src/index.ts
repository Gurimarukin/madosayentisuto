import { Application } from './Application'
import { Config } from './config/Config'
import { Future, Do } from './utils/fp'
import { DiscordConnector } from './services/DiscordConnector'

const main = (): Future<void> =>
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('client', ({ config }) => DiscordConnector.futureClient(config))
    .letL('discord', ({ client }) => DiscordConnector(client))
    .doL(({ config, discord }) => Application(config, discord))
    .return(() => {})

Future.runUnsafe(main())
