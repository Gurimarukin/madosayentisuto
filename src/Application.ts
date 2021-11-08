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
import { CallsAutoroleObserver } from './services/observers/CallsAutoroleObserver'
import { AdminCommandsObserver } from './services/observers/commands/AdminCommandsObserver'
import { MusicObserver } from './services/observers/commands/MusicObserver'
import { PingObserver } from './services/observers/commands/PingObserver'
import { NotifyGuildLeaveObserver } from './services/observers/joinLeave/NotifyGuildLeaveObserver'
import { SendWelcomeDMObserver } from './services/observers/joinLeave/SendWelcomeDMObserver'
import { SetDefaultRoleObserver } from './services/observers/joinLeave/SetDefaultRoleObserver'
import { LogMadEventsObserver } from './services/observers/LogMadEventsObserver'
import { NotifyVoiceCallObserver } from './services/observers/NotifyVoiceCallObserver'
import { DeployCommandsObserver } from './services/observers/startup/DeployCommandsObserver'
import { IndexesEnsureObserver } from './services/observers/startup/IndexesEnsureObserver'
import { ThanksCaptainObserver } from './services/observers/ThanksCaptainObserver'
import { VoiceStateUpdateTransformer } from './services/observers/transformers/VoiceStateUpdateTransformer'
import { publishDiscordEvents } from './services/publishers/publishDiscordEvents'
import { scheduleCronJob } from './services/publishers/scheduleCronJob'
import { PubSub } from './services/PubSub'
import { Future, IO, List, NonEmptyArray, Try } from './utils/fp'

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

  const guildStateService = GuildStateService(Logger, discord, guildStatePersistence)

  const pubSub = PubSub<MadEvent>()

  const sub = subscribe(logger, pubSub.observable)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ publishers/

      scheduleCronJob(Logger, pubSub.subject),
      publishDiscordEvents(discord, pubSub.subject),

      // └ observers/
      // │  └ commands/
      sub(
        AdminCommandsObserver(Logger, discord, guildStateService),
        or(MadEvent.isInteractionCreate),
      ),
      sub(MusicObserver(guildStateService), or(MadEvent.isInteractionCreate)),
      sub(PingObserver(), or(MadEvent.isInteractionCreate)),

      // │  └ joinLeave/
      sub(NotifyGuildLeaveObserver(Logger), or(MadEvent.isGuildMemberRemove)),
      sub(SendWelcomeDMObserver(Logger), or(MadEvent.isGuildMemberAdd)),
      sub(SetDefaultRoleObserver(Logger, guildStateService), or(MadEvent.isGuildMemberAdd)),

      // │  └ startup
      sub(
        IndexesEnsureObserver(Logger, pubSub.subject, [guildStatePersistence.ensureIndexes]),
        or(MadEvent.isAppStarted),
      ),
      sub(
        DeployCommandsObserver(Logger, config, discord, guildStateService),
        or(MadEvent.isDbReady),
      ),

      // │  └ transformers
      sub(VoiceStateUpdateTransformer(Logger, pubSub.subject), or(MadEvent.isVoiceStateUpdate)),

      // │
      sub(
        ActivityStatusObserver(Logger, discord, botStatePersistence),
        or(MadEvent.isAppStarted, MadEvent.isDbReady, MadEvent.isCronJob),
      ),
      sub(
        CallsAutoroleObserver(Logger, discord, guildStateService),
        or(MadEvent.isInteractionCreate),
      ),
      sub(LogMadEventsObserver(logger), or(refinement.id())),
      sub(
        NotifyVoiceCallObserver(Logger, guildStateService),
        or(MadEvent.isPublicCallStarted, MadEvent.isPublicCallEnded),
      ),
      sub(ThanksCaptainObserver(config.captain, discord), or(MadEvent.isMessageCreate)),
    ),
    IO.chain(() => pubSub.subject.next(MadEvent.AppStarted)),
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

/**
 * Syntatic sugar.
 * It isn't really a `or` operator, as it returns `not(b) [and not(c) [and not(d) ...]]`,
 * but `subscribe` (above) does a final `not`, so it ends up being a `or`.
 * And it makes `subscribe` typesafe.
 */
function or<A, B extends A>(b: Refinement<A, B>): Refinement<A, Exclude<A, B>>
function or<A, B extends A, C extends A>(
  b: Refinement<A, B>,
  c: Refinement<A, C>,
): Refinement<A, Exclude<A, B> & Exclude<A, C>>
function or<A, B extends A, C extends A, D extends A>(
  b: Refinement<A, B>,
  c: Refinement<A, C>,
  d: Refinement<A, D>,
): Refinement<A, Exclude<A, B> & Exclude<A, C> & Exclude<A, D>>
function or<A, R extends NonEmptyArray<Refinement<A, A>>>(...refinements_: R): Refinement<A, A> {
  return pipe(refinements_, NonEmptyArray.unprepend, ([head, tail]) =>
    pipe(
      tail,
      List.reduce(refinement.not(head), (acc, r) => pipe(acc, refinement.and(refinement.not(r)))),
    ),
  )
}
