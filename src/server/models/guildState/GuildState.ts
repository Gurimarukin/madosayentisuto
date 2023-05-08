import type { Message, Role } from 'discord.js'
import { eq, io } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { GuildId } from '../../../shared/models/guild/GuildId'
import type { GuildStateView } from '../../../shared/models/guild/GuildStateView'
import { RoleView } from '../../../shared/models/guild/RoleView'
import { Maybe } from '../../../shared/utils/fp'

import type { AudioSubscription } from '../../helpers/AudioSubscription'
import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { MessageUtils } from '../../utils/MessageUtils'
import { RoleUtils } from '../../utils/RoleUtils'
import { AudioState } from '../audio/AudioState'
import { Calls } from './Calls'

export type GuildState = {
  id: GuildId
  calls: Maybe<Calls>
  defaultRole: Maybe<Role>
  itsFridayChannel: Maybe<GuildSendableChannel>
  birthdayChannel: Maybe<GuildSendableChannel>
  subscription: Maybe<AudioSubscription>
  theQuestMessage: Maybe<Message<true>>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  itsFridayChannel: Maybe.none,
  birthdayChannel: Maybe.none,
  theQuestMessage: Maybe.none,
  subscription: Maybe.none,
})

const toView = (s: GuildState): io.IO<GuildStateView> =>
  pipe(
    s.subscription,
    Maybe.fold(
      () => io.of(Maybe.none),
      subscription => pipe(subscription.getAudioState, io.map(Maybe.some)),
    ),
    io.map(
      (audioState): GuildStateView => ({
        calls: pipe(s.calls, Maybe.map(Calls.toView)),
        defaultRole: pipe(s.defaultRole, Maybe.map(RoleView.fromRole)),
        itsFridayChannel: pipe(s.itsFridayChannel, Maybe.map(ChannelUtils.toView)),
        birthdayChannel: pipe(s.birthdayChannel, Maybe.map(ChannelUtils.toView)),
        theQuestMessage: pipe(s.theQuestMessage, Maybe.map(MessageUtils.toView)),
        audioState: pipe(audioState, Maybe.map(AudioState.toView)),
      }),
    ),
  )

const Eq: eq.Eq<GuildState> = eq.struct({
  id: GuildId.Eq,
  calls: Maybe.getEq(Calls.Eq),
  defaultRole: Maybe.getEq(pipe(RoleUtils.Eq.byId)),
  itsFridayChannel: Maybe.getEq(ChannelUtils.Eq.byId),
  birthdayChannel: Maybe.getEq(ChannelUtils.Eq.byId),
  theQuestMessage: Maybe.getEq(MessageUtils.Eq.byId),
  subscription: Maybe.getEq(eq.eqStrict),
})

const Lens = {
  calls: pipe(lens.id<GuildState>(), lens.prop('calls')),
  defaultRole: pipe(lens.id<GuildState>(), lens.prop('defaultRole')),
  itsFridayChannel: pipe(lens.id<GuildState>(), lens.prop('itsFridayChannel')),
  birthdayChannel: pipe(lens.id<GuildState>(), lens.prop('birthdayChannel')),
  theQuestMessage: pipe(lens.id<GuildState>(), lens.prop('theQuestMessage')),
  subscription: pipe(lens.id<GuildState>(), lens.prop('subscription')),
}

export const GuildState = { empty, toView, Lens, Eq }
