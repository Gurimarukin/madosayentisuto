import type { Role, TextChannel } from 'discord.js'
import { pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import type { GuildId } from '../../../shared/models/guild/GuildId'
import { Maybe } from '../../../shared/utils/fp'

import type { MusicSubscription } from '../../helpers/MusicSubscription'
import type { Calls } from './Calls'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly itsFridayChannel: Maybe<TextChannel>
  readonly subscription: Maybe<MusicSubscription>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  itsFridayChannel: Maybe.none,
  subscription: Maybe.none,
})

const Lens_ = {
  calls: pipe(lens.id<GuildState>(), lens.prop('calls')),
  defaultRole: pipe(lens.id<GuildState>(), lens.prop('defaultRole')),
  itsFridayChannel: pipe(lens.id<GuildState>(), lens.prop('itsFridayChannel')),
  subscription: pipe(lens.id<GuildState>(), lens.prop('subscription')),
}

export const GuildState = { empty, Lens: Lens_ }
