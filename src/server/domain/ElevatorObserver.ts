import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Store } from '../../shared/models/Store'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, List, Maybe, NotUsed, toNotUsed } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import { GuildHelper } from '../helpers/GuildHelper'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { getOnError } from '../utils/getOnError'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ElevatorObserver = (Logger: LoggerGetter, guildStateService: GuildStateService) => {
  const logger = Logger('ElevatorObserver')

  const timeoutId = Store<Maybe<NodeJS.Timeout>>(Maybe.none)

  const clearScheduledElevator: io.IO<NotUsed> = pipe(
    timeoutId.get,
    io.map(Maybe.fold(() => NotUsed, flow(clearTimeout, toNotUsed))),
  )

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event =>
    pipe(
      Future.fromIO(clearScheduledElevator),
      Future.chain(() =>
        pipe(
          GuildHelper.membersInPublicAudioChans(event.member.guild),
          List.findFirstMap(([channel, members]) =>
            members.length === 1 ? Maybe.some(channel) : Maybe.none,
          ),
          Maybe.fold(
            () => Future.notUsed,
            channel => scheduleElevator(channel),
          ),
        ),
      ),
    ),
  )

  function scheduleElevator(channel: GuildAudioChannel): Future<NotUsed> {
    return pipe(
      playElevator(channel),
      IO.fromIO,
      IO.setTimeout(getOnError(logger))(constants.elevator.delay),
      IO.chainIOK(flow(Maybe.some, timeoutId.set)),
      Future.fromIOEither,
      Future.map(toNotUsed),
    )
  }

  function playElevator(channel: GuildAudioChannel): io.IO<NotUsed> {
    return pipe(
      guildStateService.getSubscription(channel.guild),
      Future.chainIOEitherK(subscription => subscription.startElevator(channel)),
      IO.runFuture(getOnError(logger)),
    )
  }
}
