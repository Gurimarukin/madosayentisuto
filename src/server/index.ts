import { pipe } from 'fp-ts/function'

import { ConfigUtils } from '../shared/utils/ConfigUtils'
import { Future, IO } from '../shared/utils/fp'

import { Application } from './Application'
import { Config } from './Config'
import { DiscordConnector } from './helpers/DiscordConnector'
import { DiscordLogger } from './helpers/DiscordLogger'

const main: Future<void> = pipe(
  Future.Do,
  Future.apS(
    'config',
    pipe(
      ConfigUtils.loadDotEnv,
      IO.map(Config.parse),
      IO.chain(IO.fromEither),
      Future.fromIOEither,
    ),
  ),
  Future.bind('client', ({ config }) => DiscordConnector.futureClient(config.client)),
  Future.chain(({ config, client }) => {
    const discord = DiscordConnector.of(client)
    const Logger = DiscordLogger(config, discord)
    return Future.fromIOEither(Application(Logger, config, discord))
  }),
)

// eslint-disable-next-line functional/no-expression-statement
Future.runUnsafe(main)
