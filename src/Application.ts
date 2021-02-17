import { Collection, MongoClient } from 'mongodb'
import { Subscription } from 'rxjs'

import { Cli } from './commands/Cli'
import { Config } from './config/Config'
import { MongoCollection } from './models/MongoCollection'
import { MsDuration } from './models/MsDuration'
import { ObservableE } from './models/ObservableE'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { ActivityService } from './services/ActivityService'
import { DiscordConnector } from './services/DiscordConnector'
import { GuildStateService } from './services/GuildStateService'
import { CommandsHandler } from './services/handlers/CommandsHandler'
import { GuildMemberEventsHandler } from './services/handlers/GuildMemberEventsHandler'
import { MessageReactionsHandler } from './services/handlers/MessageReactionsHandler'
import { MessagesHandler } from './services/handlers/MessagesHandler'
import { VoiceStateUpdatesHandler } from './services/handlers/VoiceStateUpdatesHandler'
import { PartialLogger } from './services/Logger'
import { Either, Future, IO, Task, Try, pipe } from './utils/fp'
import { FutureUtils } from './utils/FutureUtils'

export const Application = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
): Future<void> => {
  const logger = Logger('Application')

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection: MongoCollection = (collName: string) => <A>(
    f: (c: Collection) => Promise<A>,
  ): Future<A> =>
    pipe(
      Future.apply(() => MongoClient.connect(url, { useUnifiedTopology: true })),
      Future.chain(client =>
        pipe(
          Future.apply(() => f(client.db(config.db.dbName).collection(collName))),
          Task.chain(either =>
            pipe(
              Future.apply(() => client.close()),
              Future.recover(e =>
                Future.fromIOEither(logger.error('Failed to close client:\n', e)),
              ),
              Task.map(() => either),
            ),
          ),
        ),
      ),
    )

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  const ensureIndexes = (): Future<void> =>
    pipe(
      Future.fromIOEither(logger.info('Ensuring indexes')),
      Future.chain(_ =>
        pipe(
          [guildStatePersistence.ensureIndexes()],
          Future.parallel,
          Future.map(_ => {}),
        ),
      ),
      FutureUtils.retryIfFailed(MsDuration.minutes(5), {
        onFailure: e => logger.error('Failed to ensure indexes:\n', e),
        onSuccess: _ => logger.info('Ensured indexes'),
      }),
    )

  const activityService = ActivityService(Logger, botStatePersistence, discord)
  const guildStateService = GuildStateService(Logger, guildStatePersistence, discord)

  const cli = Cli(config.cmdPrefix)

  const commandsHandler = CommandsHandler(Logger, discord, activityService, guildStateService)
  const messagesHandler = MessagesHandler(Logger, config, cli, discord, commandsHandler)
  const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, guildStateService, discord)
  const guildMemberEventsHandler = GuildMemberEventsHandler(Logger, guildStateService, discord)
  const messageReactionsHandler = MessageReactionsHandler(Logger, guildStateService, discord)

  return pipe(
    ensureIndexes(),
    Future.chain(_ => activityService.setActivityFromPersistence()),
    Future.chain(_ =>
      pipe(
        activityService.scheduleRefreshActivity(),
        IO.chain(_ => subscribe(messagesHandler, discord.messages())),
        IO.chain(_ => subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates())),
        IO.chain(_ => subscribe(guildMemberEventsHandler, discord.guildMemberEvents())),
        IO.chain(_ => subscribe(messageReactionsHandler, discord.messageReactions())),
        IO.chain(_ => logger.info('Started')),
        Future.fromIOEither,
      ),
    ),
  )

  function subscribe<A>(f: (a: A) => Future<unknown>, a: ObservableE<A>): IO<Subscription> {
    const obs = pipe(
      a,
      ObservableE.chain(_ =>
        pipe(
          Try.apply(() => f(_)),
          Future.fromEither,
          Future.chain(f => Future.apply(() => Future.runUnsafe(f))),
          ObservableE.fromTaskEither,
        ),
      ),
    )
    return IO.apply(() =>
      obs.subscribe(
        Either.fold<Error, unknown, void>(
          e => pipe(logger.error(e.stack), IO.runUnsafe),
          _ => {},
        ),
      ),
    )
  }
}
