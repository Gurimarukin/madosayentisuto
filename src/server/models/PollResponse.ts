import * as C from 'io-ts/Codec'

import { GuildId } from '../../shared/models/guild/GuildId'
import { UserId } from '../../shared/models/guild/UserId'

import { TSnowflake } from './TSnowflake'

const codec = C.struct({
  guild: GuildId.codec,
  message: TSnowflake.codec,
  user: UserId.codec,
  answerIndex: C.number,
})

export type PollResponse = C.TypeOf<typeof codec>
export type PollResponseOutput = C.OutputOf<typeof codec>

export const PollResponse = { codec }
