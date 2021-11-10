import { apply, refinement, task } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { Collection } from 'mongodb'
import { MongoClient } from 'mongodb'

import { Future, IO } from '../shared/utils/fp'

import type { Config } from './Config'
import { CallsAutoroleObserver } from './domain/CallsAutoroleObserver'
import { NotifyGuildLeaveObserver } from './domain/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './domain/NotifyVoiceCallObserver'
import { SendWelcomeDMObserver } from './domain/SendWelcomeDMObserver'
import { SetDefaultRoleObserver } from './domain/SetDefaultRoleObserver'
import { ThanksCaptainObserver } from './domain/ThanksCaptainObserver'
import { AdminCommandsObserver } from './domain/commands/AdminCommandsObserver'
import { MusicCommandsObserver } from './domain/commands/MusicCommandsObserver'
import { PingObserver } from './domain/commands/PingCommandObserver'
import { ActivityStatusObserver } from './domain/startup/ActivityStatusObserver'
import { DeployCommandsObserver } from './domain/startup/DeployCommandsObserver'
import { IndexesEnsureObserver } from './domain/startup/IndexesEnsureObserver'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { LogMadEventsObserver } from './helpers/LogMadEventsObserver'
import { VoiceStateUpdateTransformer } from './helpers/VoiceStateUpdateTransformer'
import { publishDiscordEvents } from './helpers/publishDiscordEvents'
import { scheduleCronJob } from './helpers/scheduleCronJob'
import type { MongoCollection } from './models/MongoCollection'
import { MadEvent } from './models/events/MadEvent'
import type { LoggerGetter } from './models/logger/LoggerType'
import { PubSub } from './models/rx/PubSub'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { GuildStateService } from './services/GuildStateService'
import { PubSubUtils } from './utils/PubSubUtils'

const { or } = PubSubUtils

export const Application = (
  Logger: LoggerGetter,
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
                Future.orElse(e =>
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

  const guildStateService = GuildStateService(Logger, discord, guildStatePersistence)

  const pubSub = PubSub<MadEvent>()

  const sub = PubSubUtils.subscribe(logger, pubSub.observable)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ domain/
      // │  └ commands/
      sub(
        AdminCommandsObserver(Logger, discord, guildStateService),
        or(MadEvent.isInteractionCreate),
      ),
      sub(MusicCommandsObserver(guildStateService), or(MadEvent.isInteractionCreate)),
      sub(PingObserver(), or(MadEvent.isInteractionCreate)),

      // │  └ startup/
      sub(
        ActivityStatusObserver(Logger, discord, botStatePersistence),
        or(MadEvent.isAppStarted, MadEvent.isDbReady, MadEvent.isCronJob),
      ),
      sub(
        DeployCommandsObserver(Logger, config, discord, guildStateService),
        or(MadEvent.isDbReady),
      ),
      sub(
        IndexesEnsureObserver(Logger, pubSub.subject, [guildStatePersistence.ensureIndexes]),
        or(MadEvent.isAppStarted),
      ),

      // │
      sub(CallsAutoroleObserver(Logger, guildStateService), or(MadEvent.isInteractionCreate)),
      sub(NotifyGuildLeaveObserver(Logger), or(MadEvent.isGuildMemberRemove)),
      sub(
        NotifyVoiceCallObserver(Logger, guildStateService),
        or(MadEvent.isPublicCallStarted, MadEvent.isPublicCallEnded),
      ),
      sub(SendWelcomeDMObserver(Logger), or(MadEvent.isGuildMemberAdd)),
      sub(SetDefaultRoleObserver(Logger, guildStateService), or(MadEvent.isGuildMemberAdd)),
      sub(ThanksCaptainObserver(config.captain, discord), or(MadEvent.isMessageCreate)),

      // └ helpers/
      sub(LogMadEventsObserver(logger), or(refinement.id())),
      publishDiscordEvents(discord, pubSub.subject),
      scheduleCronJob(Logger, pubSub.subject),
      sub(VoiceStateUpdateTransformer(Logger, pubSub.subject), or(MadEvent.isVoiceStateUpdate)),
    ),
    IO.chain(() => pubSub.subject.next(MadEvent.AppStarted)),
    IO.chain(() => logger.info('Started')),
  )
}
