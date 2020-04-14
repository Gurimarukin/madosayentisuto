import { Client } from 'discord.js'

import { Config } from './config/Config'
import { Application } from './services/Application'
import { Future, Do } from './utils/fp'

function futureClient(config: Config): Future<Client> {
  return Future.apply(
    () =>
      new Promise<Client>(resolve => {
        const client = new Client()
        client.on('ready', () => resolve(client))
        client.login(config.clientSecret)
      })
  )
}

const main = (): Future<void> =>
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('client', ({ config }) => futureClient(config))
    .bindL('_', ({ config, client }) => Future.fromIOEither(Application(config, client)))
    .return(() => {})

Future.runUnsafe(main())
