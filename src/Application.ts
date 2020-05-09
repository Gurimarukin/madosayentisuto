import { MongoClient, Collection } from 'mongodb'

import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import { Subscription } from 'rxjs'

import { Cli } from './commands/Cli'
import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { GuildMemberEventsHandler } from './services/handlers/GuildMemberEventsHandler'
import { MessagesHandler } from './services/handlers/MessagesHandler'
import { VoiceStateUpdatesHandler } from './services/handlers/VoiceStateUpdatesHandler'
import { IO, pipe, Either, Future, Try, List } from './utils/fp'
import { GuildStateService } from './services/GuildStateService'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'

export const Application = (config: Config, discord: DiscordConnector): Future<void> => {
  const Logger = PartialLogger(config, discord)
  const logger = Logger('Application')

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection = (coll: string): Future<Collection> =>
    pipe(
      Future.apply(() => new MongoClient(url, { useUnifiedTopology: true }).connect()),
      Future.map(_ => _.db(config.db.dbName).collection(coll))
    )

  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  const persistences: { ensureIndexes: () => Future<void> }[] = [guildStatePersistence]
  const ensureIndexes = (): Future<void> =>
    pipe(
      persistences,
      List.map(_ => _.ensureIndexes()),
      Future.sequence,
      Future.map(_ => {})
    )

  return pipe(
    discord.setActivity(config.playingActivity),
    Future.chain(_ => ensureIndexes()),
    Future.chain(_ => GuildStateService(Logger, guildStatePersistence, discord)),
    Future.chain(guildStateService => {
      const cli = Cli(config.cmdPrefix)
      const messagesHandler = MessagesHandler(Logger, config, cli, discord, guildStateService)
      const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, guildStateService, discord)
      const guildMemberEventsHandler = GuildMemberEventsHandler(Logger, guildStateService, discord)

      return pipe(
        subscribe(messagesHandler, discord.messages()),
        IO.chain(_ => subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates())),
        IO.chain(_ => subscribe(guildMemberEventsHandler, discord.guildMemberEvents())),
        IO.chain(_ => logger.info('application started')),
        Future.fromIOEither
      )
    })
  )

  function subscribe<A>(f: (a: A) => Future<unknown>, a: ObservableE<A>): IO<Subscription> {
    const obs = pipe(
      a,
      Obs.chain(_ =>
        pipe(
          Try.apply(() => f(_)),
          Future.fromEither,
          Future.chain(f => Future.apply(() => Future.runUnsafe(f))),
          Obs.fromTaskEither
        )
      )
    )
    return IO.apply(() =>
      obs.subscribe(_ =>
        pipe(
          _,
          Either.fold(
            e => pipe(logger.error(e.stack), IO.runUnsafe),
            _ => {}
          )
        )
      )
    )
  }
}
