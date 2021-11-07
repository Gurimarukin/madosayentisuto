import { Role } from 'discord.js'
import { readonlyMap } from 'fp-ts'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { Calls } from './Calls'

export type GuildState = {
  readonly id: GuildId
  readonly calls: Maybe<Calls>
  readonly defaultRole: Maybe<Role>
  readonly subscriptions: ReadonlyMap<TSnowflake, unknown>
}

const empty = (id: GuildId): GuildState => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  subscriptions: readonlyMap.empty,
})

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
  subscriptions: MonocleLens.fromPath<GuildState>()(['subscriptions']),
}

export const GuildState = { empty, Lens }
