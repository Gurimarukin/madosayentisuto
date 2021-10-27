import { pipe } from 'fp-ts/function'

import { Activity } from '../../models/Activity'
import { MadEvent } from '../../models/MadEvent'
import { Subscriber } from '../../models/Subscriber'
import { BotStatePersistence } from '../../persistence/BotStatePersistence'
import { Future, IO, Maybe } from '../../utils/fp'
import { DiscordConnector } from '../DiscordConnector'

export const ActivityStatusSubscriber = (
  botStatePersistence: BotStatePersistence,
  discord: DiscordConnector,
): Subscriber<MadEvent> => {
  return {
    next: event => {
      switch (event.type) {
        case 'AppStarted':
          return pipe(
            discord.setActivity(Maybe.some(Activity.of('PLAYING', 'hisser les voiles...'))),
            IO.map(() => {}),
          )

        case 'DbReady':
          return setActivityFromPersistence()

        case 'CronJob':
          return setActivityFromPersistence()
      }
    },
  }

  function setActivityFromPersistence(): IO<void> {
    return pipe(
      botStatePersistence.find(),
      Future.chain(({ activity }) => Future.fromIOEither(discord.setActivity(activity))),
      IO.runFuture,
    )
  }
}
