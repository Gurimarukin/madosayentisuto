import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, toNotUsed } from '../../shared/utils/fp'

import { MadEvent } from '../models/event/MadEvent'
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
        return Future.notUsed
    }
  })

  function discordSetActivityFromDb(): Future<NotUsed> {
    return pipe(botStateService.discordSetActivityFromDb(), Future.map(toNotUsed))
  }
}
