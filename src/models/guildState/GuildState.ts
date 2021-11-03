import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { StaticCalls } from './StaticCalls'

const guildStateOnlyIdCodec = C.struct({
  id: GuildId.codec,
})

export type GuildStateOnlyId = C.TypeOf<typeof guildStateOnlyIdCodec>
export const GuildStateOnlyId = { codec: guildStateOnlyIdCodec }

const of = (
  id: GuildId,
  calls: Maybe<StaticCalls>,
  defaultRole: Maybe<TSnowflake>,
): GuildState => ({ id, calls, defaultRole })

const codec = pipe(
  guildStateOnlyIdCodec,
  C.intersect(
    C.struct({
      calls: Maybe.codec(StaticCalls.codec),
      defaultRole: Maybe.codec(TSnowflake.codec),
    }),
  ),
)

const empty = (id: GuildId): GuildState => of(id, Maybe.none, Maybe.none)

const Lens = {
  calls: MonocleLens.fromPath<GuildState>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildState>()(['defaultRole']),
}

export type GuildState = C.TypeOf<typeof codec>
export type GuildStateOutput = C.OutputOf<typeof codec>

export const GuildState = { of, codec, empty, Lens }
