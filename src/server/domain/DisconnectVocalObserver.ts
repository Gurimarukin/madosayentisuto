import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, List } from '../../shared/utils/fp'

import type { AudioStateNotDisconnected } from '../models/audio/AudioState'
import { AudioState } from '../models/audio/AudioState'
import { MadEvent } from '../models/event/MadEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

export const DisconnectVocalObserver = (
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelConnected',
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event => {
    if (DiscordUserId.fromUser(event.member.user) === clientId) return Future.notUsed

    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(event.member.guild)),
      Future.bind('state', ({ subscription }) => Future.fromIO(subscription.getAudioState)),
      Future.chain(({ subscription, state }) =>
        AudioState.isNotConnected(state) && shouldDisconnect(state)
          ? subscription.disconnect
          : Future.notUsed,
      ),
    )
  })

  function shouldDisconnect({ channel }: AudioStateNotDisconnected): boolean {
    return botIsConnectedToChannel(channel) && botIsAloneInChannel(channel)
  }

  function botIsConnectedToChannel(channel: GuildAudioChannel): boolean {
    return pipe(
      channel.members.toJSON(),
      List.some(member => DiscordUserId.fromUser(member.user) === clientId),
    )
  }

  function botIsAloneInChannel(channel: GuildAudioChannel): boolean {
    return channel.members.size === 1
  }
}
