import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'

import { MessageId } from '../MessageId'

const codec = C.struct({
  message: MessageId.codec,
  user: DiscordUserId.codec,
  choiceIndex: C.number,
})

const of = (message: MessageId, user: DiscordUserId, choiceIndex: number): PollResponse => ({
  message,
  user,
  choiceIndex,
})

export type PollResponse = C.TypeOf<typeof codec>
export type PollResponseOutput = C.OutputOf<typeof codec>

export const PollResponse = { codec, of }
