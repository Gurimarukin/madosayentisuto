import { pipe } from 'fp-ts/function'

import { Future, List, Maybe } from '../../shared/utils/fp'

import type { MadEventVoiceStateUpdate } from '../models/event/MadEvent'
import type { MusicChannel } from '../models/music/MusicState'
import { MusicState } from '../models/music/MusicState'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'

export const DisconnectVocalObserver = (
  cliendId: string,
  guildStateService: GuildStateService,
): TObserver<MadEventVoiceStateUpdate> => {
  return {
    next: event =>
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
  }

  function botIsAloneInChannel(channel: MusicChannel): boolean {
    return (
      channel.members.size === 1 &&
      pipe(
        channel.members.toJSON(),
        List.every(m => m.id === cliendId),
      )
    )
  }
}
