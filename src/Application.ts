import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Collection, MongoClient } from 'mongodb'

import { Config } from './config/Config'
import { MadEvent } from './models/MadEvent'
import { MongoCollection } from './models/MongoCollection'
import { ActivityStatusObserver } from './observers/ActivityStatusObserver'
import { IndexesEnsureObserver } from './observers/IndexesEnsureObserver'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { PubSub } from './services/PubSub'
import { Future, IO } from './utils/fp'

export const Application = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
): IO<void> => {
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

  const botStatePersistence = BotStatePersistence(Logger, mongoCollection)
  const guildStatePersistence = GuildStatePersistence(Logger, mongoCollection)

  return pipe(
    PubSub<MadEvent>(Logger),
    IO.chain(pubSub => {
      const activityStatusObserver = ActivityStatusObserver(botStatePersistence, discord)
      const indexesEnsureObserver = IndexesEnsureObserver(Logger, pubSub, [
        guildStatePersistence.ensureIndexes,
      ])

      return pipe(
        IO.Do,
        IO.chain(() => pubSub.subscribe(activityStatusObserver)),
        IO.chain(() => pubSub.subscribe(indexesEnsureObserver)),
        IO.chain(() => pubSub.publish(MadEvent.AppStarted)),
        IO.chain(() => logger.info('Started')),
      )
    }),
  )
}
