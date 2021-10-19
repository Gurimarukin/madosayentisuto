import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { StaticCalls } from './StaticCalls'

const of = (
  id: GuildId,
  calls: Maybe<StaticCalls>,
  defaultRole: Maybe<TSnowflake>,
): GuildState => ({ id, calls, defaultRole })

const codec = C.struct({
  id: GuildId.codec,
  calls: Maybe.codec(StaticCalls.codec),
  defaultRole: Maybe.codec(TSnowflake.codec),
})

const empty = (id: GuildId): GuildState => of(id, Maybe.none, Maybe.none)

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
}

export type GuildState = C.TypeOf<typeof codec>
export type GuildStateOutput = C.OutputOf<typeof codec>

export const GuildState = { of, codec, empty, Lens }
