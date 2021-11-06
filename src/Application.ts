import util from 'util'

import { apply, refinement, task } from 'fp-ts'
import { observable } from 'fp-ts-rxjs'
import { pipe } from 'fp-ts/function'
import { Refinement } from 'fp-ts/Refinement'
import { Collection, MongoClient } from 'mongodb'
import { Subscription } from 'rxjs'

import { Config } from './config/Config'
import { MadEvent } from './models/MadEvent'
import { MongoCollection } from './models/MongoCollection'
import { TObservable } from './models/TObservable'
import { TObserver } from './models/TObserver'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { DiscordConnector } from './services/DiscordConnector'
import { GuildStateService } from './services/GuildStateService'
import { Logger as LoggerType, PartialLogger } from './services/Logger'
import { ActivityStatusObserver } from './services/observers/ActivityStatusObserver'
import { DeployCommandsObserver } from './services/observers/DeployCommandsObserver'
import { IndexesEnsureObserver } from './services/observers/IndexesEnsureObserver'
import { NotifyGuildLeaveObserver } from './services/observers/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './services/observers/NotifyVoiceCallObserver'
import { PingObserver } from './services/observers/PingObserver'
import { SendGreetingDMObserver } from './services/observers/SendGreetingDMObserver'
import { SetDefaultRoleObserver } from './services/observers/SetDefaultRoleObserver'
import { ThanksCaptainObserver } from './services/observers/ThanksCaptainObserver'
import { publishDiscordEvents } from './services/publishers/publishDiscordEvents'
import { scheduleCronJob } from './services/publishers/scheduleCronJob'
import { PubSub } from './services/PubSub'
import { Future, IO, Maybe, Try } from './utils/fp'

const { and, not } = refinement

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

  const guildStateService = GuildStateService(guildStatePersistence, discord)

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
    IO.chainFirst(({ pubSub }) => scheduleCronJob(Logger, pubSub.subject)),
    IO.chainFirst(({ pubSub }) => publishDiscordEvents(discord, pubSub.subject)),
    IO.chain(({ pubSub }) => {
      const s = subscribe(logger, pubSub.observable)
      return pipe(
        apply.sequenceT(IO.ApplicativePar)(
          // startup
          s(
            ActivityStatusObserver(Logger, discord, botStatePersistence),
            pipe(
              not(MadEvent.isAppStarted),
              and(not(MadEvent.isDbReady)),
              and(not(MadEvent.isCronJob)),
            ),
          ),
          s(
            IndexesEnsureObserver(Logger, pubSub.subject, [guildStatePersistence.ensureIndexes]),
            not(MadEvent.isAppStarted),
          ),
          s(
            DeployCommandsObserver(config.client, Logger, guildStateService),
            not(MadEvent.isDbReady),
          ),

          // leave/join
          s(SendGreetingDMObserver(Logger), not(MadEvent.isGuildMemberAdd)),
          s(SetDefaultRoleObserver(Logger, guildStateService), not(MadEvent.isGuildMemberAdd)),
          s(NotifyGuildLeaveObserver(Logger), not(MadEvent.isGuildMemberRemove)),

          // calls
          s(
            NotifyVoiceCallObserver(Logger, guildStateService, pubSub.subject),
            pipe(
              not(MadEvent.isVoiceStateUpdate),
              and(not(MadEvent.isPublicCallStarted)),
              and(not(MadEvent.isPublicCallEnded)),
            ),
          ),

          // messages
          s(ThanksCaptainObserver(config.captain, Logger, discord), not(MadEvent.isMessageCreate)),

          // commands
          s(PingObserver(), not(MadEvent.isInteractionCreate)),
        ),
        IO.chain(() => pubSub.subject.next(MadEvent.AppStarted)),
      )
    }),
    IO.chain(() => logger.info('Started')),
  )
}

const subscribe =
  <A>(logger: LoggerType, observable_: TObservable<A>) =>
  <B extends A>(
    { next }: TObserver<B>,
    // we invert it, so we are sure our Refinement is exhaustive
    refinement_: Refinement<A, Exclude<A, B>>,
  ): IO<Subscription> =>
    pipe(
      observable_,
      observable.filter(refinement.not(refinement_) as unknown as Refinement<A, B>),
      TObservable.subscribe({
        next: b =>
          pipe(
            next(b),
            task.chain(Try.fold(e => Future.fromIOEither(logger.error(e.stack)), Future.right)),
          ),
      }),
    )
