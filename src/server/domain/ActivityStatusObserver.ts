import { pipe } from 'fp-ts/function'

import { DateUtils } from '../../shared/utils/DateUtils'
import { Future, Maybe } from '../../shared/utils/fp'

import { constants } from '../constants'
import type {
  MadEventAppStarted,
  MadEventCronJob,
  MadEventDbReady,
} from '../models/events/MadEvent'
import type { TObserver } from '../models/rx/TObserver'
import type { BotStateService } from '../services/BotStateService'

export const ActivityStatusObserver = (
  botStateService: BotStateService,
): TObserver<MadEventAppStarted | MadEventDbReady | MadEventCronJob> => {
  return {
    next: event => {
      switch (event.type) {
        case 'AppStarted':
          return botStateService.discordSetActivity(Maybe.some(constants.defaultActivity))

        case 'DbReady':
          return discordSetActivityFromDb()

        case 'CronJob':
          if (DateUtils.is8am(event.date)) return discordSetActivityFromDb()
          return Future.unit
      }
    },
  }

  function discordSetActivityFromDb(): Future<void> {
    return pipe(
      botStateService.discordSetActivityFromDb(),
      Future.map(() => {}),
    )
  }
}
