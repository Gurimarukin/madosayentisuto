import { flow, pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, Maybe, toUnit } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import { GuildHelper } from '../helpers/GuildHelper'
import { Store } from '../models/Store'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ElevatorObserver = (Logger: LoggerGetter) => {
  const logger = Logger('ElevatorObserver')

  const timeoutId = Store<Maybe<NodeJS.Timeout>>(Maybe.none)

  const clearScheduledElevator: IO<void> = pipe(
    timeoutId.get,
    IO.map(Maybe.fold(() => undefined, clearTimeout)),
  )

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(({ member }) =>
    pipe(
      Future.fromIOEither(clearScheduledElevator),
      Future.chain(() => {
        const inPublicChans = GuildHelper.membersInPublicAudioChans(member.guild)

        if (inPublicChans.length === 1) return scheduleElevator()

        return Future.unit
      }),
    ),
  )

  function scheduleElevator(): Future<void> {
    return pipe(
      playElevator(),
      IO.setTimeout(constants.elevatorDelay),
      IO.chain(flow(Maybe.some, timeoutId.set)),
      Future.fromIOEither,
      Future.map(toUnit),
    )
  }

  function playElevator(): IO<void> {
    return logger.info('>>>>> playElevator')
  }
}
