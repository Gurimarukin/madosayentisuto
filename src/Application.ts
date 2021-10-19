import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Collection, MongoClient } from 'mongodb'

import { Config } from './config/Config'
import { MongoCollection } from './models/MongoCollection'
import { MsDuration } from './models/MsDuration'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { Future } from './utils/fp'
import { FutureUtils } from './utils/FutureUtils'

export const Application = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
): Future<void> => {
  const logger = Logger('Application')

  const url = `mongodb://${config.db.user}:${config.db.password}@${config.db.host}`
  const mongoCollection: MongoCollection =
    (collName: string) =>
    <O, A>(f: (c: Collection<O>) => Promise<A>): Future<A> =>
      pipe(
        Future.tryCatch(() => MongoClient.connect(url)),
        Future.chain(client =>
          pipe(
            Future.tryCatch(() => f(client.db(config.db.dbName).collection(collName))),
            task.chain(either =>
              pipe(
                Future.tryCatch(() => client.close()),
                Future.recover(e =>
                  Future.fromIOEither(logger.error('Failed to close client:\n', e)),
                ),
                task.map(() => either),
              ),
            ),
          ),
        ),
      )

  console.log('discord =', discord)

  // const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  const ensureIndexes = (): Future<void> =>
    pipe(
      Future.fromIOEither(logger.info('Ensuring indexes')),
      Future.chain(() =>
        pipe(
          [guildStatePersistence.ensureIndexes()],
          Future.sequenceArray,
          Future.map(() => {}),
        ),
      ),
      FutureUtils.retryIfFailed(MsDuration.minutes(5), {
        onFailure: e => logger.error('Failed to ensure indexes:\n', e),
        onSuccess: () => logger.info('Ensured indexes'),
      }),
    )

  // const activityService = ActivityService(Logger, botStatePersistence, discord)
  // const guildStateService = GuildStateService(guildStatePersistence, discord)

  // const cli = Cli(config.cmdPrefix)

  // const commandsHandler = CommandsHandler(Logger, discord, activityService, guildStateService)
  // const messagesHandler = MessagesHandler(Logger, config, cli, discord, commandsHandler)
  // const voiceStateUpdatesHandler = VoiceStateUpdatesHandler(Logger, guildStateService, discord)
  // const guildMemberEventsHandler = GuildMemberEventsHandler(Logger, guildStateService, discord)
  // const messageReactionsHandler = MessageReactionsHandler(Logger, guildStateService, discord)

  return pipe(
    ensureIndexes(),
    // Future.chain(() => activityService.setActivityFromPersistence()),
    Future.chain(
      () =>
        // pipe(
        // activityService.scheduleRefreshActivity(),
        // IO.chain(() => subscribe(messagesHandler, discord.messages())),
        // IO.chain(() => subscribe(voiceStateUpdatesHandler, discord.voiceStateUpdates())),
        // IO.chain(() => subscribe(guildMemberEventsHandler, discord.guildMemberEvents())),
        // IO.chain(() => subscribe(messageReactionsHandler, discord.messageReactions())),
        Future.fromIOEither(logger.info('Started')),
      // ),
    ),
  )

  // function subscribe<A>(f: (a: A) => Future<unknown>, oa: ObservableE<A>): IO<Subscription> {
  //   const obs = pipe(
  //     oa,
  //     ObservableE.chain(a =>
  //       pipe(
  //         Try.tryCatch(() => f(a)),
  //         Future.fromEither,
  //         Future.chain(f_ => Future.tryCatch(() => Future.runUnsafe(f_))),
  //         ObservableE.fromTaskEither,
  //       ),
  //     ),
  //   )
  //   return IO.tryCatch(() =>
  //     obs.subscribe(
  //       Either.fold<Error, unknown, void>(
  //         e => pipe(logger.error(e.stack), IO.runUnsafe),
  //         () => {},
  //       ),
  //     ),
  //   )
  // }
}
