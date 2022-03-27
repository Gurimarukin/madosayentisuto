import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as DE from 'io-ts/DecodeError'
import * as D from 'io-ts/Decoder'
import { lens } from 'monocle-ts'

import { UserId } from '../../../shared/models/guild/UserId'
import { Either, List, Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'

import { MessageId } from '../MessageId'
import type { ChoiceWithResponses } from './ChoiceWithResponses'

export type Poll = {
  readonly message: MessageId
  readonly createdBy: UserId
  readonly question: string
  readonly choices: NonEmptyArray<ChoiceWithResponses>
}

const commonFields = D.struct({
  message: MessageId.codec,
  createdBy: UserId.codec,
  question: D.string,
  choices: NonEmptyArray.decoder(D.string),
})

const groupedChoices = D.struct({
  _id: D.number,
  responses: NonEmptyArray.decoder(UserId.codec),
})

const decoder = {
  decode: (u: unknown) =>
    pipe(
      apply.sequenceT(Either.getApplicativeValidation(DE.getSemigroup<string>()))(
        D.tuple(commonFields).decode(u),
        NonEmptyArray.decoder(groupedChoices).decode(u),
      ),
      Either.map(([[{ message, createdBy, question, choices }], nea]) => ({
        message,
        createdBy,
        question,
        choices: pipe(
          choices,
          NonEmptyArray.mapWithIndex(
            (index, choice): ChoiceWithResponses => ({
              choice,
              responses: pipe(
                nea,
                List.findFirst(r => r._id === index),
                Maybe.map(r => r.responses),
                Maybe.getOrElseW(() => List.empty),
              ),
            }),
          ),
        ),
      })),
    ),
}

const Lens = {
  choices: pipe(lens.id<Poll>(), lens.prop('choices')),
}

export const Poll = { decoder, Lens }
