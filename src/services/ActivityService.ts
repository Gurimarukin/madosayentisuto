import { PartialLogger } from './Logger'
import { DiscordConnector } from './DiscordConnector'
import { Activity } from '../models/Activity'
import { BotState } from '../models/BotState'
import { BotStatePersistence } from '../persistence/BotStatePersistence'
import { IO, pipe, Task, Future, Maybe } from '../utils/fp'

const refreshActivityEvery = 24 * 60 * 60 * 1000

export function ActivityService(
  Logger: PartialLogger,
  botStatePersistence: BotStatePersistence,
  discord: DiscordConnector
) {
  const logger = Logger('ActivityService')

  return {
    getActivity,

    setActivity: (activity: Activity): Future<void> =>
      pipe(
        upsertActivity(Maybe.some(activity)),
        Future.chain(_ => discordSetActivity(activity))
      ),

    setActivityFromPersistence,

    unsetActivity: (): Future<void> =>
      pipe(
        upsertActivity(Maybe.none),
        Future.chain(_ => Future.fromIOEither(logger.info('Unsetting activity'))),
        Future.chain(_ => discord.setActivity(Maybe.none)),
        Future.map(_ => {})
      ),

    scheduleRefreshActivity: (): IO<void> => {
      const now = new Date()
      const tomorrow8am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8)
      const untilTomorrow8am = new Date(tomorrow8am.getTime() - now.getTime())
      return pipe(
        logger.info(
          `Scheduling activity refresh: 8am is in ${untilTomorrow8am.getHours()}h${untilTomorrow8am.getMinutes()}`
        ),
        IO.chain(_ =>
          pipe(
            setRefreshActivityInterval(),
            Future.fromIOEither,
            Task.delay(untilTomorrow8am.getTime()),
            IO.runFuture
          )
        )
      )
    }
  }

  function getActivity(): Future<Maybe<Activity>> {
    return pipe(
      botStatePersistence.find(),
      Future.map(({ activity }) => activity)
    )
  }

  function discordSetActivity(activity: Activity): Future<void> {
    return pipe(
      logger.info(`Setting activity: ${activity.type} ${activity.name}`),
      Future.fromIOEither,
      Future.chain(_ => discord.setActivity(Maybe.some(activity))),
      Future.map(_ => {})
    )
  }

  function upsertActivity(activity: Maybe<Activity>) {
    return pipe(
      botStatePersistence.find(),
      Future.map(BotState.Lens.activity.set(activity)),
      Future.chain(botStatePersistence.upsert)
    )
  }

  function setRefreshActivityInterval(): IO<void> {
    return pipe(
      setActivityFromPersistence(),
      IO.runFuture,
      IO.chain(_ =>
        IO.apply(() =>
          setInterval(
            () => pipe(setActivityFromPersistence(), Future.runUnsafe),
            refreshActivityEvery
          )
        )
      ),
      IO.map(_ => {})
    )
  }

  function setActivityFromPersistence(): Future<unknown> {
    return pipe(
      getActivity(),
      Future.chain(
        Maybe.fold(
          () => pipe(logger.info('No activity to set'), Future.fromIOEither),
          discordSetActivity
        )
      )
    )
  }
}

export type ActivityService = ReturnType<typeof ActivityService>
