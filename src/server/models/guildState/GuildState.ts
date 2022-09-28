import type { Role } from 'discord.js'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import type { GuildId } from '../../../shared/models/guild/GuildId'
import type { GuildStateView } from '../../../shared/models/guild/GuildStateView'
import { RoleView } from '../../../shared/models/guild/RoleView'
import { Maybe } from '../../../shared/utils/fp'

import type { AudioSubscription } from '../../helpers/AudioSubscription'
import type { GuildSendableChannel } from '../../utils/ChannelUtils'
import { ChannelUtils } from '../../utils/ChannelUtils'
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

const toView = (s: GuildState): GuildStateView => ({
  calls: pipe(s.calls, Maybe.map(Calls.toView)),
  defaultRole: pipe(s.defaultRole, Maybe.map(RoleView.fromRole)),
  itsFridayChannel: pipe(s.itsFridayChannel, Maybe.map(ChannelUtils.toView)),
  birthdayChannel: pipe(s.birthdayChannel, Maybe.map(ChannelUtils.toView)),
})

const Lens = {
  calls: pipe(lens.id<GuildState>(), lens.prop('calls')),
  defaultRole: pipe(lens.id<GuildState>(), lens.prop('defaultRole')),
  itsFridayChannel: pipe(lens.id<GuildState>(), lens.prop('itsFridayChannel')),
  birthdayChannel: pipe(lens.id<GuildState>(), lens.prop('birthdayChannel')),
  subscription: pipe(lens.id<GuildState>(), lens.prop('subscription')),
}

export const GuildState = { empty, toView, Lens }
