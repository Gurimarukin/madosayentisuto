import type { Role, TextChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { ChannelView } from '../../../shared/models/ChannelView'
import type { GuildId } from '../../../shared/models/guild/GuildId'
import type { GuildStateView } from '../../../shared/models/guild/GuildStateView'
import { RoleView } from '../../../shared/models/guild/RoleView'
import { Maybe } from '../../../shared/utils/fp'

import type { MusicSubscription } from '../../helpers/MusicSubscription'
import { Calls } from './Calls'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly itsFridayChannel: Maybe<TextChannel>
  readonly birthdayChannel: Maybe<TextChannel>
  readonly subscription: Maybe<MusicSubscription>
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
  itsFridayChannel: pipe(s.itsFridayChannel, Maybe.map(ChannelView.fromChannel)),
  birthdayChannel: pipe(s.birthdayChannel, Maybe.map(ChannelView.fromChannel)),
})

const Lens = {
  calls: pipe(lens.id<GuildState>(), lens.prop('calls')),
  defaultRole: pipe(lens.id<GuildState>(), lens.prop('defaultRole')),
  itsFridayChannel: pipe(lens.id<GuildState>(), lens.prop('itsFridayChannel')),
  birthdayChannel: pipe(lens.id<GuildState>(), lens.prop('birthdayChannel')),
  subscription: pipe(lens.id<GuildState>(), lens.prop('subscription')),
}

export const GuildState = { empty, toView, Lens }
