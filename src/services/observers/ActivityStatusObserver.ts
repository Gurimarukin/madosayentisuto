import { pipe } from 'fp-ts/function'

import { Activity } from '../../models/Activity'
import { AppStarted, CronJob, DbReady } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { BotStatePersistence } from '../../persistence/BotStatePersistence'
import { Future, IO, Maybe } from '../../utils/fp'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'

export const ActivityStatusObserver = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  botStatePersistence: BotStatePersistence,
): TObserver<AppStarted | DbReady | CronJob> => {
  const logger = Logger('ActivityStatusObserver')

  return {
    next: event => {
      switch (event.type) {
        case 'AppStarted':
          return discordSetActivity(Maybe.some(Activity.of('PLAYING', 'hisser les voiles...')))

        case 'DbReady':
        case 'CronJob':
          return pipe(
            botStatePersistence.find(),
            Future.chain(({ activity }) => Future.fromIOEither(discordSetActivity(activity))),
            IO.runFuture,
          )
      }
    },
  }

  function discordSetActivity(maybeActivity: Maybe<Activity>): IO<void> {
    return pipe(
      maybeActivity,
      Maybe.fold(
        () => logger.info('Unsetting activity'),
        activity => logger.info(`Setting activity: ${activity.type} ${activity.name}`),
      ),
      IO.chain(() => discord.setActivity(maybeActivity)),
      IO.map(() => {}),
    )
  }
}
