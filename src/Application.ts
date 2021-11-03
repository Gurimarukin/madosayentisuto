import util from 'util'

import { apply, refinement, task } from 'fp-ts'
import { observable } from 'fp-ts-rxjs'
import { flow, pipe } from 'fp-ts/function'
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
import { IndexesEnsureObserver } from './services/observers/IndexesEnsureObserver'
import { NotifyGuildLeaveObserver } from './services/observers/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './services/observers/NotifyVoiceCallObserver'
import { SendGreetingDMObserver } from './services/observers/SendGreetingDMObserver'
import { SetDefaultRoleObserver } from './services/observers/SetDefaultRoleObserver'
import { publishDiscordEvents } from './services/publishers/publishDiscordEvents'
import { scheduleCronJob } from './services/publishers/scheduleCronJob'
import { PubSub } from './services/PubSub'
import { Future, IO, List, Maybe, NonEmptyArray, Try } from './utils/fp'

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
          s(
            ActivityStatusObserver(Logger, discord, botStatePersistence),
            MadEvent.isAppStarted,
            MadEvent.isDbReady,
            MadEvent.isCronJob,
          ),
          s(
            IndexesEnsureObserver(Logger, pubSub.subject, [guildStatePersistence.ensureIndexes]),
            MadEvent.isAppStarted,
          ),
          s(SendGreetingDMObserver(Logger), MadEvent.isGuildMemberAdd),
          s(SetDefaultRoleObserver(Logger, guildStateService), MadEvent.isGuildMemberAdd),
          s(NotifyGuildLeaveObserver(Logger), MadEvent.isGuildMemberRemove),
          s(NotifyVoiceCallObserver(Logger, guildStateService), MadEvent.isVoiceStateUpdate),
        ),
        IO.chain(() => pubSub.subject.next(MadEvent.AppStarted)),
      )
    }),
    IO.chain(() => logger.info('Started')),
  )
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function subscribe<A>(logger: LoggerType, observable_: TObservable<A>) {
  return res

  function res(o: TObserver<A>): IO<Subscription>
  function res<B extends A>(o: TObserver<B>, b: Refinement<A, B>): IO<Subscription>
  function res<B extends A, C extends A>(
    o: TObserver<B | C>,
    b: Refinement<A, B>,
    c: Refinement<A, C>,
  ): IO<Subscription>
  function res<B extends A, C extends A, D extends A>(
    o: TObserver<B | C | D>,
    b: Refinement<A, B>,
    c: Refinement<A, C>,
    d: Refinement<A, D>,
  ): IO<Subscription>
  function res(
    { next, error, complete }: TObserver<A>,
    ...refinements: List<Refinement<A, A>>
  ): IO<Subscription> {
    const observer: TObserver<A> = {
      ...(next !== undefined ? { next: recover(next) } : {}),
      ...(error !== undefined ? { error: recover(error) } : {}),
      ...(complete !== undefined ? { complete: recover(complete) } : {}),
    } as TObserver<A>

    return pipe(
      NonEmptyArray.fromReadonlyArray(refinements),
      Maybe.fold(
        () => observable_,
        flow(NonEmptyArray.concatAll({ concat: (a, b) => pipe(a, refinement.or(b)) }), r =>
          pipe(observable_, observable.filter(r)),
        ),
      ),
      TObservable.subscribe(observer),
    )
  }

  function recover<B extends List<unknown>>(
    f: (...args: B) => Future<void>,
  ): (...args: B) => Future<void> {
    return (...args) =>
      pipe(
        f(...args),
        task.chain(Try.fold(e => Future.fromIOEither(logger.error(e.stack)), Future.right)),
      )
  }
}
