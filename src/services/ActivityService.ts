import { PartialLogger } from './Logger'
import { DiscordConnector } from './DiscordConnector'
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
    setActivityFromPersistence,

    scheduleRefreshActivity: (): IO<void> => {
      const now = new Date()
      const tomorrow8am = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8)
      const untilTomorrow8am = tomorrow8am.getTime() - now.getTime()
      return pipe(
        setRefreshActivityInterval(),
        Future.fromIOEither,
        Task.delay(untilTomorrow8am),
        IO.runFuture
      )
    }
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

  function setActivityFromPersistence(): Future<void> {
    return pipe(
      botStatePersistence.find(),
      Future.chain(_ =>
        pipe(
          _.activity,
          Maybe.fold(
            () => pipe(logger.info('No activity to set'), Future.fromIOEither),
            activity =>
              pipe(
                logger.info(`Setting activity: ${activity.type} ${activity.name}`),
                Future.fromIOEither,
                Future.chain(_ => discord.setActivity(Maybe.some(activity))),
                Future.map(_ => {})
              )
          )
        )
      )
    )
  }
}

export type ActivityService = ReturnType<typeof ActivityService>
