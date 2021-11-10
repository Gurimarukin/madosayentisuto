import type { ApplicationCommandType } from 'discord-api-types/payloads/v9'
import * as D from 'io-ts/Decoder'

import { Maybe } from '../../../shared/utils/fp'

import { GuildId } from '../GuildId'
import { TSnowflake } from '../TSnowflake'
import { CommandId } from './CommandId'

const applicationCommandTypeCodec: D.Decoder<unknown, ApplicationCommandType> = D.union(
  D.literal(1),
  D.literal(2),
  D.literal(3),
)

const codec = D.struct({
  id: CommandId.codec,
  application_id: TSnowflake.codec,
  version: D.string,
  default_permission: D.boolean,
  default_member_permissions: Maybe.decoder(D.boolean),
  type: applicationCommandTypeCodec,
  name: D.string,
  description: D.string,
  guild_id: GuildId.codec,
  options: Maybe.decoder(D.array(D.id<unknown>())),
})

export type PutCommandResult = D.TypeOf<typeof codec>
export const PutCommandResult = { codec }
