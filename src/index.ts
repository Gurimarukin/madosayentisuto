import { Client } from 'discord.js'

import { Application } from './Application'
import { Config } from './config/Config'
import { Future, Do } from './utils/fp'
import { DiscordConnector } from './services/DiscordConnector'

const main = (): Future<void> =>
  Do(Future.taskEither)
    .bind('config', Future.fromIOEither(Config.load()))
    .bindL('discord', ({ config }) => futureDiscord(config))
    .doL(({ config, discord }) => Application(config, discord))
    .return(() => {})

Future.runUnsafe(main())

const futureDiscord = (config: Config): Future<DiscordConnector> =>
  Future.apply(
    () =>
      new Promise<DiscordConnector>(resolve => {
        const client = new Client()
        client.on('ready', () => resolve(DiscordConnector(client)))
        client.login(config.clientSecret)
      })
  )
