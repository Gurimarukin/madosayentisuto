import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { ChannelId } from '../../../../shared/models/ChannelId'
import { MessageId } from '../../../../shared/models/MessageId'
import { GuildId } from '../../../../shared/models/guild/GuildId'
import { Dict, Maybe } from '../../../../shared/utils/fp'

import { RoleId } from '../../RoleId'
import type { GuildState } from '../GuildState'
import { CallsDb } from './CallsDb'

const properties = {
  id: GuildId.codec,
  calls: Maybe.codec(CallsDb.codec),
  defaultRole: Maybe.codec(RoleId.codec),
  itsFridayChannel: Maybe.codec(ChannelId.codec),
  birthdayChannel: Maybe.codec(ChannelId.codec),
  theQuestMessage: Maybe.codec(MessageId.codec),
}

const keys = Dict.keys(properties)

const codec = C.struct(properties)

const empty = (id: GuildId): GuildStateDb => ({
  id,
  calls: Maybe.none,
  defaultRole: Maybe.none,
  itsFridayChannel: Maybe.none,
  birthdayChannel: Maybe.none,
  theQuestMessage: Maybe.none,
})

const fromGuildState = ({
  id,
  calls,
  defaultRole,
  itsFridayChannel,
  birthdayChannel,
  theQuestMessage,
}: GuildState): GuildStateDb => ({
  id,
  calls: pipe(calls, Maybe.map(CallsDb.fromCalls)),
  defaultRole: pipe(
    defaultRole,
    Maybe.map(r => RoleId.fromRole(r)),
  ),
  itsFridayChannel: pipe(itsFridayChannel, Maybe.map(ChannelId.fromChannel)),
  birthdayChannel: pipe(birthdayChannel, Maybe.map(ChannelId.fromChannel)),
  theQuestMessage: pipe(theQuestMessage, Maybe.map(MessageId.fromMessage)),
})

export type GuildStateDb = C.TypeOf<typeof codec>
export type GuildStateDbOutput = C.OutputOf<typeof codec>

export const GuildStateDb = { codec, keys, empty, fromGuildState }

const onlyItsFridayChannelCodec = C.struct({
  itsFridayChannel: ChannelId.codec,
})

export type GuildStateDbOnlyItsFridayChannel = C.TypeOf<typeof onlyItsFridayChannelCodec>
export const GuildStateDbOnlyItsFridayChannel = { codec: onlyItsFridayChannelCodec }
