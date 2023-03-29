import * as D from 'io-ts/Decoder'

import { Either } from '../../../shared/utils/fp'

import { TheQuestProgressionApi } from './TheQuestProgressionApi'
import { TheQuestProgressionError } from './TheQuestProgressionError'

type TheQuestProgressionResult = D.TypeOf<typeof decoder>

const decoder = D.sum('type')({
  summonerNotFound: D.struct({
    type: D.literal('summonerNotFound'),
    error: TheQuestProgressionError.decoder,
  }),
  ok: D.struct({
    type: D.literal('ok'),
    progression: TheQuestProgressionApi.decoder,
  }),
})

const toEither = (
  r: TheQuestProgressionResult,
): Either<TheQuestProgressionError, TheQuestProgressionApi> => {
  switch (r.type) {
    case 'summonerNotFound':
      return Either.left(r.error)
    case 'ok':
      return Either.right(r.progression)
  }
}

const TheQuestProgressionResult = { decoder, toEither }

export { TheQuestProgressionResult }
