import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../utils/fp'
import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { GuildState } from './GuildState'
import { StaticCalls } from './StaticCalls'

const guildStateDbOnlyIdCodec = C.struct({
  id: GuildId.codec,
})

export type GuildStateDbOnlyId = C.TypeOf<typeof guildStateDbOnlyIdCodec>
export const GuildStateDbOnlyId = { codec: guildStateDbOnlyIdCodec }

const codec = pipe(
  guildStateDbOnlyIdCodec,
  C.intersect(
    C.struct({
      calls: Maybe.codec(StaticCalls.codec),
      defaultRole: Maybe.codec(TSnowflake.codec),
    }),
  ),
)

const empty = (id: GuildId): GuildStateDb => ({ id, calls: Maybe.none, defaultRole: Maybe.none })

const fromGuildState = ({ id, calls, defaultRole }: GuildState): GuildStateDb => ({
  id,
  calls: pipe(calls, Maybe.map(StaticCalls.fromCalls)),
  defaultRole: pipe(
    defaultRole,
    Maybe.map(r => TSnowflake.wrap(r.id)),
  ),
})

export type GuildStateDb = C.TypeOf<typeof codec>
export type GuildStateDbOutput = C.OutputOf<typeof codec>

export const GuildStateDb = { codec, empty, fromGuildState }
