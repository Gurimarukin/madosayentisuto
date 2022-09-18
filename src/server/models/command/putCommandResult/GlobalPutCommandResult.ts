import type { ApplicationCommandType } from 'discord.js'
import * as D from 'io-ts/Decoder'

import { createEnum } from '../../../../shared/utils/createEnum'
import { List, Maybe } from '../../../../shared/utils/fp'

import { ApplicationId } from '../../ApplicationId'
import { CommandId } from '../CommandId'

const { codec: applicationCommandTypeCodec } = createEnum<ApplicationCommandType>(1, 2, 3)

const decoder = D.struct({
  id: CommandId.codec,
  application_id: ApplicationId.codec,
  version: D.string,
  default_permission: D.boolean,
  default_member_permissions: Maybe.decoder(D.boolean),
  type: applicationCommandTypeCodec,
  name: D.string,
  description: D.string,
  options: Maybe.decoder(List.decoder(D.id<unknown>())),
})

export type GlobalPutCommandResult = D.TypeOf<typeof decoder>
export const GlobalPutCommandResult = { decoder }
