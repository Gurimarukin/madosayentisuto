import { pipe } from 'fp-ts/function'

import { Future, IO, Maybe } from '../../shared/utils/fp'

import { constants } from '../constants'
import type { DiscordConnector } from '../helpers/DiscordConnector'
import type { Activity } from '../models/botState/Activity'
import type {
  MadEventAppStarted,
  MadEventCronJob,
  MadEventDbReady,
} from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { BotStatePersistence } from '../persistence/BotStatePersistence'

export const ActivityStatusObserver = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  botStatePersistence: BotStatePersistence,
): TObserver<MadEventAppStarted | MadEventDbReady | MadEventCronJob> => {
  const logger = Logger('ActivityStatusObserver')

  return {
    next: event => {
      switch (event.type) {
        case 'AppStarted':
          return discordSetActivity(Maybe.some(constants.defaultActivity))

        case 'DbReady':
        case 'CronJob':
          return pipe(
            botStatePersistence.find(),
            Future.chain(({ activity }) => discordSetActivity(activity)),
          )
      }
    },
  }

  function discordSetActivity(maybeActivity: Maybe<Activity>): Future<void> {
    return pipe(
      maybeActivity,
      Maybe.fold(
        () => logger.info('Unsetting activity'),
        activity => logger.info(`Setting activity: ${activity.type} ${activity.name}`),
      ),
      IO.chain(() => discord.setActivity(maybeActivity)),
      IO.map(() => {}),
      Future.fromIOEither,
    )
  }
}
