import { apply, refinement, task } from 'fp-ts'
import { observable } from 'fp-ts-rxjs'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'
import type { Collection } from 'mongodb'
import { MongoClient } from 'mongodb'
import type { Subscription } from 'rxjs'

import { Future, IO, List, NonEmptyArray, Try } from '../shared/utils/fp'

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
import { MadEvent } from './models/MadEvent'
import type { MongoCollection } from './models/MongoCollection'
import type { LoggerGetter, LoggerType } from './models/logger/LoggerType'
import { PubSub } from './models/rx/PubSub'
import { TObservable } from './models/rx/TObservable'
import type { TObserver } from './models/rx/TObserver'
import { BotStatePersistence } from './persistence/BotStatePersistence'
import { GuildStatePersistence } from './persistence/GuildStatePersistence'
import { scheduleCronJob } from './persistence/scheduleCronJob'
import { GuildStateService } from './services/GuildStateService'

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
      sub(MusicCommandsObserver(guildStateService), or(MadEvent.isInteractionCreate)),
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
      sub(CallsAutoroleObserver(Logger, guildStateService), or(MadEvent.isInteractionCreate)),
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
