import { io } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, Maybe, toUnit } from '../../shared/utils/fp'

import { constants } from '../config/constants'
import { GuildHelper } from '../helpers/GuildHelper'
import { Store } from '../models/Store'
import { MadEvent } from '../models/event/MadEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ElevatorObserver = (guildStateService: GuildStateService) => {
  const timeoutId = Store<Maybe<NodeJS.Timeout>>(Maybe.none)

  const clearScheduledElevator: io.IO<void> = pipe(
    timeoutId.get,
    io.map(Maybe.fold(() => undefined, clearTimeout)),
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
        const inPublicChans = GuildHelper.membersInPublicAudioChans(event.member.guild)

        if (inPublicChans.length === 1) {
          return scheduleElevator(
            ((): GuildAudioChannel => {
              switch (event.type) {
                case 'AudioChannelConnected':
                case 'AudioChannelDisconnected':
                  return event.channel
                case 'AudioChannelMoved':
                  return event.to
              }
            })(),
          )
        }

        return Future.unit
      }),
    ),
  )

  function scheduleElevator(channel: GuildAudioChannel): Future<void> {
    return pipe(
      playElevator(channel),
      IO.setTimeout(constants.elevator.delay),
      IO.chainIOK(flow(Maybe.some, timeoutId.set)),
      Future.fromIOEither,
      Future.map(toUnit),
    )
  }

  function playElevator(channel: GuildAudioChannel): IO<void> {
    return pipe(
      guildStateService.getSubscription(channel.guild),
      Future.chain(subscription => subscription.startElevator(channel)),
      IO.runFutureUnsafe,
    )
  }
}
