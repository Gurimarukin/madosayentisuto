import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { List, Maybe } from '../../shared/utils/fp'

import { TSnowflake } from './TSnowflake'

export type PollButton = {
  readonly messageId: TSnowflake
  readonly index: number
}

const pollButtonPrefix = 'poll'

const of = (messageId: TSnowflake, index: number): PollButton => ({ messageId, index })

const format = ({ messageId, index }: PollButton): string =>
  `${pollButtonPrefix}-${TSnowflake.unwrap(messageId)}-${index}`

const parse = (raw: string): Maybe<PollButton> => {
  const [rawPoll, rawMessageId, rawIndex, ...rest] = pipe(raw, string.split('-'))

  return pipe(
    Maybe.Do,
    Maybe.filter(() => rawPoll === pollButtonPrefix && List.isEmpty(rest)),
    Maybe.bind('messageId', () => nonEmptyString(rawMessageId)),
    Maybe.bind('indexStr', () => nonEmptyString(rawIndex)),
    Maybe.bind('index', ({ indexStr }) => numberFromString(indexStr)),
    Maybe.map(({ messageId, index }) => of(TSnowflake.wrap(messageId), index)),
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
