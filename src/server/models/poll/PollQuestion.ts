import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { MessageId } from '../MessageId'
import { ThreadWithMessage } from './ThreadWithMessage'

const codec = C.struct({
  message: MessageId.codec,
  createdBy: DiscordUserId.codec,
  question: C.string,
  choices: NonEmptyArray.codec(C.string),
  detail: Maybe.codec(ThreadWithMessage.codec),
  isAnonymous: C.boolean,
  isMultiple: C.boolean,
})

export type PollQuestion = C.TypeOf<typeof codec>
export type PollQuestionOutput = C.OutputOf<typeof codec>

export const PollQuestion = { codec }
