import { pipe } from 'fp-ts/function'

import { Activity } from '../../models/Activity'
import { MadEvent } from '../../models/MadEvent'
import { Subscriber } from '../../models/Subscriber'
import { BotStatePersistence } from '../../persistence/BotStatePersistence'
import { Future, IO, Maybe } from '../../utils/fp'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'

export const ActivityStatusSubscriber = (
  Logger: PartialLogger,
  discord: DiscordConnector,
  botStatePersistence: BotStatePersistence,
): Subscriber<MadEvent> => {
  const logger = Logger('ActivityStatusSubscriber')

  return {
    next: event => {
      if (event.type === 'AppStarted') {
        return discordSetActivity(Maybe.some(Activity.of('PLAYING', 'hisser les voiles...')))
      }

      if (event.type === 'DbReady' || event.type === 'CronJob') {
        return pipe(
          botStatePersistence.find(),
          Future.chain(({ activity }) => Future.fromIOEither(discordSetActivity(activity))),
          IO.runFuture,
        )
      }

      return IO.unit
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
