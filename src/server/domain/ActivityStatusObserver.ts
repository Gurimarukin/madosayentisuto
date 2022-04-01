import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { Future, toUnit } from '../../shared/utils/fp'

import { MadEvent } from '../models/event/MadEvent'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { BotStateService } from '../services/BotStateService'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ActivityStatusObserver = (botStateService: BotStateService) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
    'CronJob',
  )(event => {
    switch (event.type) {
      case 'AppStarted':
        return discordSetActivityFromDb()

      case 'CronJob':
        if (pipe(event.date, DayJs.isHourSharp(8))) return discordSetActivityFromDb()
        return Future.unit
    }
  })

  function discordSetActivityFromDb(): Future<void> {
    return pipe(botStateService.discordSetActivityFromDb(), Future.map(toUnit))
  }
}
