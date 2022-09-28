import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { Future, List, Maybe } from '../../shared/utils/fp'

import { AudioState } from '../models/audio/AudioState'
import { MadEvent } from '../models/event/MadEvent'
import type { GuildStateService } from '../services/GuildStateService'
import type { GuildAudioChannel } from '../utils/ChannelUtils'

// disconnect when bot is alone in channel

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DisconnectVocalObserver = (
  clientId: DiscordUserId,
  guildStateService: GuildStateService,
) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AudioChannelMoved',
    'AudioChannelDisconnected',
  )(event => {
    if (DiscordUserId.fromUser(event.member.user) === clientId) return Future.unit

    const channelLeft = ((): GuildAudioChannel => {
      switch (event.type) {
        case 'AudioChannelMoved':
          return event.from
        case 'AudioChannelDisconnected':
          return event.channel
      }
    })()

    return pipe(
      Future.Do,
      Future.apS('subscription', guildStateService.getSubscription(channelLeft.guild)),
      Future.bind('maybeChannel', ({ subscription }) =>
        pipe(subscription.getState, Future.fromIOEither, Future.map(AudioState.getChannel)),
      ),
      Future.chain(({ subscription, maybeChannel }) =>
        pipe(maybeChannel, Maybe.exists(botIsAloneInChannel))
          ? subscription.disconnect
          : Future.unit,
      ),
    )
  })

  function botIsAloneInChannel(channel: GuildAudioChannel): boolean {
    return (
      channel.members.size === 1 &&
      pipe(
        channel.members.toJSON(),
        List.every(member => DiscordUserId.fromUser(member.user) === clientId),
      )
    )
  }
}
