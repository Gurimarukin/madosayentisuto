import { MongoClient, Collection } from 'mongodb'

import { Subscription } from 'rxjs'

import { Cli } from './commands/Cli'
import { Config } from './config/Config'
import { ObservableE } from './models/ObservableE'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { ActivityService } from './services/ActivityService'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { CommandsHandler } from './services/handlers/CommandsHandler'
import { GuildMemberEventsHandler } from './services/handlers/GuildMemberEventsHandler'
import { MessagesHandler } from './services/handlers/MessagesHandler'
import { VoiceStateUpdatesHandler } from './services/handlers/VoiceStateUpdatesHandler'
import { MessageReactionsHandler } from './services/handlers/MessageReactionsHandler'
import { GuildStateService } from './services/GuildStateService'
import { IO, pipe, Either, Future, Try, List, Task } from './utils/fp'

export const Application = (config: Config, discord: DiscordConnector): Future<void> => {
  const Logger = PartialLogger(config, discord)
  const logger = Logger('Application')

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection = (coll: string): Future<Collection> =>
    pipe(
      Future.apply(() => new MongoClient(url, { useUnifiedTopology: true }).connect()),
      Future.map(_ => _.db(config.db.dbName).collection(coll))
    )

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  const persistences: { ensureIndexes: () => Future<void> }[] = [guildStatePersistence]
  const ensureIndexes = (): Future<void> =>
    pipe(
      Future.fromIOEither(logger.info('Ensuring indexes')),
      Future.chain(_ =>
        pipe(
          persistences,
          List.map(_ => _.ensureIndexes()),
          Future.sequence,
          Future.map(_ => {})
        )
      )
    )

  const activityService = ActivityService(Logger, botStatePersistence, discord)
  const guildStateService = GuildStateService(Logger, guildStatePersistence, discord)

  const cli = Cli(config.cmdPrefix)

  const commandsHandler = CommandsHandler(Logger, botStatePersistence, discord, guildStateService)
  const messagesHandler = MessagesHandler(Logger, config, cli, discord, commandsHandler)
  const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, guildStateService, discord)
  const guildMemberEventsHandler = GuildMemberEventsHandler(Logger, guildStateService, discord)
  const messageReactionsHandler = MessageReactionsHandler(Logger, guildStateService, discord)

  return pipe(
    retryIfFailed(ensureIndexes()),
    Future.chain(_ => activityService.setActivityFromPersistence()),
    Future.chain(_ =>
      pipe(
        subscribe(messagesHandler, discord.messages()),
        IO.chain(_ => subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates())),
        IO.chain(_ => subscribe(guildMemberEventsHandler, discord.guildMemberEvents())),
        IO.chain(_ => subscribe(messageReactionsHandler, discord.messageReactions())),
        IO.chain(_ => logger.info('Started')),
        Future.fromIOEither
      )
    )
  )

  function subscribe<A>(f: (a: A) => Future<unknown>, a: ObservableE<A>): IO<Subscription> {
    const obs = pipe(
      a,
      ObservableE.chain(_ =>
        pipe(
          Try.apply(() => f(_)),
          Future.fromEither,
          Future.chain(f => Future.apply(() => Future.runUnsafe(f))),
          ObservableE.fromTaskEither
        )
      )
    )
    return IO.apply(() =>
      obs.subscribe(
        Either.fold<Error, unknown, void>(
          e => pipe(logger.error(e.stack), IO.runUnsafe),
          _ => {}
        )
      )
    )
  }

  function retryIfFailed(f: Future<void>, firstTime = true): Future<void> {
    return pipe(
      f,
      Task.chain(
        Either.fold(
          e =>
            pipe(
              firstTime ? logger.error('Failed to ensure indexes:\n', e) : IO.unit,
              IO.chain(_ => IO.runFuture(Task.delay(5 * 60 * 1000)(retryIfFailed(f, false)))),
              Future.fromIOEither
            ),
          _ => Future.fromIOEither(logger.info('Ensured indexes'))
        )
      )
    )
  }
}
