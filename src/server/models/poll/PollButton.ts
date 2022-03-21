import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List, Maybe } from '../../../shared/utils/fp'

export type PollButton = {
  readonly answerIndex: number
}

const pollButtonPrefix = 'poll'

const of = (answerIndex: number): PollButton => ({ answerIndex })

const format = ({ answerIndex }: PollButton): string => `${pollButtonPrefix}-${answerIndex}`

const parse = (raw: string): Maybe<PollButton> => {
  const [rawPoll, rawIndex, ...rest] = pipe(raw, string.split('-'))

  return pipe(
    Maybe.Do,
    Maybe.filter(() => rawPoll === pollButtonPrefix && List.isEmpty(rest)),
    Maybe.chain(() => nonEmptyString(rawIndex)),
    Maybe.chain(numberFromString),
    Maybe.map(of),
  )
}

export const PollButton = { of, format, parse }

// raw should not be empty and not have additional triming spaces
const nonEmptyString = (raw: string | undefined): Maybe<string> => {
  if (raw === undefined || raw === '') return Maybe.none

  const trimed = raw.trim()
  return trimed === raw ? Maybe.some(raw) : Maybe.none
}

const numberFromString = (str: string): Maybe<number> => {
  const n = Number(str)
  return isNaN(n) ? Maybe.none : Maybe.some(n)
}
