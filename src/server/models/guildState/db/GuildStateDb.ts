import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { GuildId } from '../../../../shared/models/guild/GuildId'
import { Dict, Maybe } from '../../../../shared/utils/fp'

import { TSnowflake } from '../../TSnowflake'
import type { GuildState } from '../GuildState'
import { CallsDb } from './CallsDb'

const onlyIdProperties = {
  id: GuildId.codec,
}

const onlyIdCodec = C.struct(onlyIdProperties)

export type GuildStateDbOnlyId = C.TypeOf<typeof onlyIdCodec>
export const GuildStateDbOnlyId = { codec: onlyIdCodec }

const properties = {
  calls: Maybe.codec(CallsDb.codec),
  defaultRole: Maybe.codec(TSnowflake.codec),
  itsFridayChannel: Maybe.codec(TSnowflake.codec),
}

const keys = Dict.keys(properties)

const codec = pipe(onlyIdCodec, C.intersect(C.struct(properties)))

const empty = (id: GuildId): GuildStateDb => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  itsFridayChannel: Maybe.none,
})

const fromGuildState = ({
  id,
  calls,
  defaultRole,
  itsFridayChannel,
}: GuildState): GuildStateDb => ({
  id,
  calls: pipe(calls, Maybe.map(CallsDb.fromCalls)),
  defaultRole: pipe(
    defaultRole,
    Maybe.map(r => TSnowflake.wrap(r.id)),
  ),
  itsFridayChannel: pipe(
    itsFridayChannel,
    Maybe.map(c => TSnowflake.wrap(c.id)),
  ),
})

export type GuildStateDb = C.TypeOf<typeof codec>
export type GuildStateDbOutput = C.OutputOf<typeof codec>

export const GuildStateDb = { codec, keys, empty, fromGuildState }

const onlyItsFridayChannelCodec = C.struct({
  itsFridayChannel: TSnowflake.codec,
})

export type GuildStateDbOnlyItsFridayChannel = C.TypeOf<typeof onlyItsFridayChannelCodec>
export const GuildStateDbOnlyItsFridayChannel = { codec: onlyItsFridayChannelCodec }
