import { pipe } from 'fp-ts/function'

import { Future } from './shared/utils/fp'

import { Application } from './bot/Application'
import { Config } from './bot/Config'
import { DiscordConnector } from './bot/helpers/DiscordConnector'
import { DiscordLogger } from './bot/helpers/DiscordLogger'

const main: Future<void> = pipe(
  Future.Do,
  Future.bind('config', () => Future.fromIOEither(Config.load())),
  Future.bind('client', ({ config }) => DiscordConnector.futureClient(config.client)),
  Future.chain(({ config, client }) => {
    const discord = DiscordConnector.of(client)
    const Logger = DiscordLogger(config, discord)
    return Future.fromIOEither(Application(Logger, config, discord))
  }),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
