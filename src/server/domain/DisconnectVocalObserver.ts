import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, List, Maybe } from '../../shared/utils/fp'

import { AudioState } from '../models/audio/AudioState'
import { MadEvent } from '../models/event/MadEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DisconnectVocalObserver = (
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event => {
    if (DiscordUserId.fromUser(event.member.user) === clientId) return Future.unit

    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(event.member.guild)),
      Future.bind('state', ({ subscription }) => Future.fromIO(subscription.getState)),
      Future.chain(({ subscription, state }) =>
        pipe(state, AudioState.channel.get, Maybe.exists(shouldDisconnect(state)))
          ? subscription.disconnect
          : Future.unit,
      ),
    )
  })

  function shouldDisconnect(state: AudioState): (channel: GuildAudioChannel) => boolean {
    return channel =>
      botIsConnectedToChannel(channel) &&
      ((): boolean => {
        const botIsAloneInChannel = channel.members.size === 1

        switch (state.value.type) {
          case 'Music':
            return botIsAloneInChannel
          case 'Elevator':
            return botIsAloneInChannel || 3 <= channel.members.size // more than one member with the bot
        }
      })()
  }

  function botIsConnectedToChannel(channel: GuildAudioChannel): boolean {
    return pipe(
      channel.members.toJSON(),
      List.some(member => DiscordUserId.fromUser(member.user) === clientId),
    )
  }
}
