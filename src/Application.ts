import util from 'util'

import { task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Collection, MongoClient } from 'mongodb'

import { Config } from './config/Config'
import { MadEvent } from './models/MadEvent'
import { MongoCollection } from './models/MongoCollection'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { DiscordConnector } from './services/DiscordConnector'
import { PartialLogger } from './services/Logger'
import { publishDiscordEvents } from './services/publishers/publishDiscordEvents'
import { scheduleCronJob } from './services/publishers/scheduleCronJob'
import { PubSub } from './services/PubSub'
import { ActivityStatusSubscriber } from './services/subscribers/ActivityStatusSubscriber'
import { IndexesEnsureSubscriber } from './services/subscribers/IndexesEnsureSubscriber'
import { NotifyGuildLeaveSubscriber } from './services/subscribers/NotifyGuildLeaveSubscriber'
import { SendGreetingDMSubscriber } from './services/subscribers/SendGreetingDMSubscriber'
import { Future, IO, Maybe } from './utils/fp'

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
    IO.Do,
    IO.bind('pubSub', () =>
      PubSub<MadEvent>(
        Logger,
        Maybe.some(({ type, ...rest }) => [
          type,
          util.formatWithOptions({ breakLength: Infinity }, rest),
        ]),
      ),
    ),
    IO.chainFirst(({ pubSub }) => scheduleCronJob(Logger, pubSub)),
    IO.chainFirst(({ pubSub }) => publishDiscordEvents(discord, pubSub)),
    IO.chain(({ pubSub }) =>
      pipe(
        [
          ActivityStatusSubscriber(Logger, discord, botStatePersistence),
          IndexesEnsureSubscriber(Logger, pubSub, [guildStatePersistence.ensureIndexes]),
          SendGreetingDMSubscriber(Logger, discord),
          NotifyGuildLeaveSubscriber(Logger, discord),
        ],
        IO.traverseArray(pubSub.subscribe),
        IO.chain(() => pubSub.publish(MadEvent.AppStarted)),
        IO.chain(() => logger.info('Started')),
      ),
    ),
  )
}
