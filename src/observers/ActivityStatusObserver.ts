import { pipe } from 'fp-ts/function'

import { Activity } from '../models/Activity'
import { MadEvent } from '../models/MadEvent'
import { Subscriber } from '../models/Subscriber'
import { BotStatePersistence } from '../persistence/BotStatePersistence'
import { DiscordConnector } from '../services/DiscordConnector'
import { Future, IO, Maybe } from '../utils/fp'

export const ActivityStatusObserver = (
  botStatePersistence: BotStatePersistence,
  discord: DiscordConnector,
): Subscriber<MadEvent> => ({
  next: event => {
    switch (event.type) {
      case 'AppStarted':
        return pipe(
          discord.setActivity(Maybe.some(Activity.of('PLAYING', 'hisser les voiles...'))),
          IO.map(() => {}),
        )

      case 'IndexesEnsured':
        return pipe(
          botStatePersistence.find(),
          Future.chain(({ activity }) => Future.fromIOEither(discord.setActivity(activity))),
          IO.runFuture,
        )
    }
  },
})
