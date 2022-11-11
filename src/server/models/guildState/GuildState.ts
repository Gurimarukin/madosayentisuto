import type { Role } from 'discord.js'
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
import { RoleUtils } from '../../utils/RoleUtils'
import { AudioState } from '../audio/AudioState'
import { Calls } from './Calls'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly itsFridayChannel: Maybe<GuildSendableChannel>
  readonly birthdayChannel: Maybe<GuildSendableChannel>
  readonly subscription: Maybe<AudioSubscription>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  itsFridayChannel: Maybe.none,
  birthdayChannel: Maybe.none,
  subscription: Maybe.none,
})

const toView = (s: GuildState): io.IO<GuildStateView> =>
  pipe(
    s.subscription,
    Maybe.fold(
      () => io.of(Maybe.none),
      subscription => pipe(subscription.getAudioState, io.map(Maybe.some)),
    ),
    io.map(audioState => ({
      calls: pipe(s.calls, Maybe.map(Calls.toView)),
      defaultRole: pipe(s.defaultRole, Maybe.map(RoleView.fromRole)),
      itsFridayChannel: pipe(s.itsFridayChannel, Maybe.map(ChannelUtils.toView)),
      birthdayChannel: pipe(s.birthdayChannel, Maybe.map(ChannelUtils.toView)),
      audioState: pipe(audioState, Maybe.map(AudioState.toView)),
    })),
  )

const Eq: eq.Eq<GuildState> = eq.struct({
  id: GuildId.Eq,
  calls: Maybe.getEq(Calls.Eq),
  defaultRole: Maybe.getEq(pipe(RoleUtils.EqById)),
  itsFridayChannel: Maybe.getEq(ChannelUtils.EqById),
  birthdayChannel: Maybe.getEq(ChannelUtils.EqById),
  subscription: Maybe.getEq(eq.eqStrict),
})

const Lens = {
  calls: pipe(lens.id<GuildState>(), lens.prop('calls')),
  defaultRole: pipe(lens.id<GuildState>(), lens.prop('defaultRole')),
  itsFridayChannel: pipe(lens.id<GuildState>(), lens.prop('itsFridayChannel')),
  birthdayChannel: pipe(lens.id<GuildState>(), lens.prop('birthdayChannel')),
  subscription: pipe(lens.id<GuildState>(), lens.prop('subscription')),
}

export const GuildState = { empty, toView, Lens, Eq }
