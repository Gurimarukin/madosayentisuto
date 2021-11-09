import type { DiscordConnector } from 'bot/helpers/DiscordConnector'
import { Activity } from 'bot/models/botState/Activity'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { AppStarted, CronJob, DbReady } from 'bot/models/MadEvent'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { BotStatePersistence } from 'bot/persistence/BotStatePersistence'
import { pipe } from 'fp-ts/function'
import { Future, IO, Maybe } from 'shared/utils/fp'

export const ActivityStatusObserver = (
  Logger: LoggerGetter,
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
