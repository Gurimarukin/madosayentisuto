import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { Store } from '../../shared/models/Store'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { LogUtils } from '../../shared/utils/LogUtils'
import { Future, IO, List, Maybe, NotUsed, toNotUsed } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import { GuildHelper } from '../helpers/GuildHelper'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

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
      Future.chain(() => {
        const channel = ((): GuildAudioChannel => {
          switch (event.type) {
            case 'AudioChannelConnected':
            case 'AudioChannelDisconnected':
              return event.channel
            case 'AudioChannelMoved':
              return event.to
          }
        })()

        const shouldScheduleElevator = pipe(
          GuildHelper.membersInPublicAudioChans(event.member.guild),
          List.exists(([chan, members]) => chan.id === channel.id && members.length === 1),
        )

        if (shouldScheduleElevator) return scheduleElevator(channel)

        return Future.notUsed
      }),
    ),
  )

  function scheduleElevator(channel: GuildAudioChannel): Future<NotUsed> {
    return pipe(
      playElevator(channel),
      IO.fromIO,
      IO.setTimeout(LogUtils.onError(logger))(constants.elevator.delay),
      IO.chainIOK(flow(Maybe.some, timeoutId.set)),
      Future.fromIOEither,
      Future.map(toNotUsed),
    )
  }

  function playElevator(channel: GuildAudioChannel): io.IO<NotUsed> {
    return pipe(
      guildStateService.getSubscription(channel.guild),
      Future.chainIOEitherK(subscription => subscription.startElevator(channel)),
      IO.runFuture(LogUtils.onError(logger)),
    )
  }
}
