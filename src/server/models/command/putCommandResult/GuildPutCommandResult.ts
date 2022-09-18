import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { GuildId } from '../../../../shared/models/guild/GuildId'

import { GlobalPutCommandResult } from './GlobalPutCommandResult'

const decoder = pipe(
  GlobalPutCommandResult.decoder,
  D.intersect(
    D.struct({
      guild_id: GuildId.codec,
    }),
  ),
)

export type GuildPutCommandResult = D.TypeOf<typeof decoder>
export const GuildPutCommandResult = { decoder }
