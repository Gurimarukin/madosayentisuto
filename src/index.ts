import { Client } from 'discord.js'

import { Application } from './Application'
import { Config } from './config/Config'
import { Future, Do } from './utils/fp'

const main = (): Future<void> =>
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('client', ({ config }) => futureClient(config))
    .bindL('_', ({ config, client }) => Future.fromIOEither(Application(config, client)))
    .return(() => {})

Future.runUnsafe(main())

const futureClient = (config: Config): Future<Client> =>
  Future.apply(
    () =>
      new Promise<Client>(resolve => {
        const client = new Client()
        client.on('ready', () => resolve(client))
        client.login(config.clientSecret)
      })
  )
