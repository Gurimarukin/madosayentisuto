import * as C from 'io-ts/Codec'

import { UserId } from '../../../shared/models/guild/UserId'
import { NonEmptyArray } from '../../../shared/utils/fp'

import { MessageId } from '../MessageId'

const codec = C.struct({
  message: MessageId.codec,
  createdBy: UserId.codec,
  question: C.string,
  choices: NonEmptyArray.codec(C.string),
})

export type PollQuestion = C.TypeOf<typeof codec>
export type PollQuestionOutput = C.OutputOf<typeof codec>

export const PollQuestion = { codec }
