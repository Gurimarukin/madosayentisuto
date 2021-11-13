import type { Role, TextChannel } from 'discord.js'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../../shared/utils/fp'

import type { MusicSubscription } from '../../helpers/music/MusicSubscription'
import type { GuildId } from '../GuildId'
import type { Calls } from './Calls'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly subscription: Maybe<MusicSubscription>
  readonly itsFridayChannel: Maybe<TextChannel>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  subscription: Maybe.none,
  itsFridayChannel: Maybe.none,
})

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
  subscription: MonocleLens.fromPath<GuildState>()(['subscription']),
  itsFridayChannel: MonocleLens.fromPath<GuildState>()(['itsFridayChannel']),
}

export const GuildState = { empty, Lens }
