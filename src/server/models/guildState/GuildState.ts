import type { Role, TextChannel } from 'discord.js'
import { Lens as MonocleLens } from 'monocle-ts'

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

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
  itsFridayChannel: MonocleLens.fromPath<GuildState>()(['itsFridayChannel']),
  subscription: MonocleLens.fromPath<GuildState>()(['subscription']),
}

export const GuildState = { empty, Lens }
