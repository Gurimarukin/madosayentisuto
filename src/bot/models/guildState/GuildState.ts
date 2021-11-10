import type { Role } from 'discord.js'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../../shared/utils/fp'

import type { GuildId } from '../GuildId'
import type { Calls } from './Calls'
import type { MusicSubscription } from './MusicSubscription'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly subscription: Maybe<MusicSubscription>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  subscription: Maybe.none,
})

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
  subscription: MonocleLens.fromPath<GuildState>()(['subscription']),
}

export const GuildState = { empty, Lens }
