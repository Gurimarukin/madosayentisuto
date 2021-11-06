import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { StaticCalls } from './StaticCalls'

const guildStateDbOnlyIdCodec = C.struct({
  id: GuildId.codec,
})

export type GuildStateDbOnlyId = C.TypeOf<typeof guildStateDbOnlyIdCodec>
export const GuildStateDbOnlyId = { codec: guildStateDbOnlyIdCodec }

const of = (
  id: GuildId,
  calls: Maybe<StaticCalls>,
  defaultRole: Maybe<TSnowflake>,
): GuildStateDb => ({ id, calls, defaultRole })

const codec = pipe(
  guildStateDbOnlyIdCodec,
  C.intersect(
    C.struct({
      calls: Maybe.codec(StaticCalls.codec),
      defaultRole: Maybe.codec(TSnowflake.codec),
    }),
  ),
)

const empty = (id: GuildId): GuildStateDb => of(id, Maybe.none, Maybe.none)

const Lens = {
  calls: MonocleLens.fromPath<GuildStateDb>()(['calls']),
  defaultRole: MonocleLens.fromPath<GuildStateDb>()(['defaultRole']),
}

export type GuildStateDb = C.TypeOf<typeof codec>
export type GuildStateDbOutput = C.OutputOf<typeof codec>

export const GuildStateDb = { of, codec, empty, Lens }
