import { Client } from 'discord.js'
import { Subscription } from 'rxjs'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { Pong } from './Pong'
import { Config } from '../config/Config'
import { ObservableE } from '../models/ObservableE'
import { Do, IO, Try } from '../utils/fp'

export const Application = (initConfig: Config, client: Client): IO<void> => {
  const Logger = PartialLogger(initConfig.logger, client.users)

  const logger = Logger('Application')

  const discordConnector = DiscordConnector(client)

  const pong = Pong(Logger, discordConnector)

  return Do(IO.ioEither)
    .bind('_1', logger.info('application started'))
    .bind('_2', subscribe(pong))
    .return(() => {})
}

const subscribe = <A>(obs: ObservableE<A>): IO<Subscription> =>
  IO.apply(() => obs.subscribe(Try.get))
