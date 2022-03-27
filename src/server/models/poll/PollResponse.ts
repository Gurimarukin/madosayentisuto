import * as C from 'io-ts/Codec'

import { UserId } from '../../../shared/models/guild/UserId'

import { MessageId } from '../MessageId'

const codec = C.struct({
  message: MessageId.codec,
  user: UserId.codec,
  choiceIndex: C.number,
})

const of = (message: MessageId, user: UserId, choiceIndex: number): PollResponse => ({
  message,
  user,
  choiceIndex,
})

export type PollResponse = C.TypeOf<typeof codec>
export type PollResponseOutput = C.OutputOf<typeof codec>

export const PollResponse = { codec, of }
