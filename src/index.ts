import { pipe } from 'fp-ts/function'

import { Application } from './Application'
import { Config } from './config/Config'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { Future } from './utils/fp'

const main: Future<void> = pipe(
  Future.Do,
  Future.bind('config', () => Future.fromIOEither(Config.load())),
  Future.bind('client', ({ config }) => DiscordConnector.futureClient(config)),
  Future.chain(({ config, client }) => {
    const discord = DiscordConnector.of(client)
    const Logger = PartialLogger(config, discord)
    return Future.fromIOEither(Application(Logger, config, discord))
  }),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
