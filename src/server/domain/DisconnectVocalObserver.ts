import { pipe } from 'fp-ts/function'

import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, List, Maybe } from '../../shared/utils/fp'

import { MadEvent } from '../models/event/MadEvent'
import { MusicState } from '../models/music/MusicState'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

// disconnect when bot is alone in channel

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DisconnectVocalObserver = (cliendId: string, guildStateService: GuildStateService) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'VoiceStateUpdate',
  )(event =>
    pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(event.newState.guild)),
      Future.bind('maybeChannel', ({ subscription }) =>
        pipe(subscription.getState, Future.fromIOEither, Future.map(MusicState.getChannel)),
      ),
      Future.chain(({ subscription, maybeChannel }) =>
        pipe(maybeChannel, Maybe.exists(botIsAloneInChannel))
          ? subscription.disconnect()
          : Future.unit,
      ),
    ),
  )

  function botIsAloneInChannel(channel: GuildAudioChannel): boolean {
    return (
      channel.members.size === 1 &&
      pipe(
        channel.members.toJSON(),
        List.every(m => m.id === cliendId),
      )
    )
  }
}
