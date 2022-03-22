import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { Future, Maybe, toUnit } from '../../shared/utils/fp'

import { constants } from '../constants'
import { MadEvent } from '../models/event/MadEvent'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { BotStateService } from '../services/BotStateService'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ActivityStatusObserver = (botStateService: BotStateService) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
    'DbReady',
    'CronJob',
  )(event => {
    switch (event.type) {
      case 'AppStarted':
        return botStateService.discordSetActivity(Maybe.some(constants.defaultActivity))

      case 'DbReady':
        return discordSetActivityFromDb()

      case 'CronJob':
        if (DayJs.is8am(event.date)) return discordSetActivityFromDb()
        return Future.unit
    }
  })

  function discordSetActivityFromDb(): Future<void> {
    return pipe(botStateService.discordSetActivityFromDb(), Future.map(toUnit))
  }
}
