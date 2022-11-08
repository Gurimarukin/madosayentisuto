import { random, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../models/DayJs'
import { MsDuration } from '../models/MsDuration'
import type { NonEmptyArray, Tuple } from './fp'
import { List, Maybe } from './fp'

const margin = /^\s*\|/gm
const stripMargins = (str: string): string => str.replace(margin, '')

const ellipse =
  (take: number) =>
  (str: string): string =>
    take < str.length && 3 <= take ? `${str.slice(0, take - 3)}...` : str

const matcher =
  <A>(regex: RegExp, f: (arr: RegExpMatchArray) => A) =>
  (str: string): Maybe<A> =>
    pipe(str.match(regex), Maybe.fromNullable, Maybe.map(f))

const matcher1 = (regex: RegExp): ((str: string) => Maybe<string>) =>
  matcher(regex, ([, a]) => a as string)

const matcher2 = (regex: RegExp): ((str: string) => Maybe<Tuple<string, string>>) =>
  matcher(regex, ([, a, b]) => [a, b] as Tuple<string, string>)

const padStart =
  (maxLength: number) =>
  (n: number): string =>
    `${n}`.padStart(maxLength, '0')

const pad10 = padStart(2)
const pad100 = padStart(3)

const cleanUTF8ToASCII = (str: string): string =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const reverse: (str: string) => string = flow(string.split(''), List.reverse, List.mkString(''))

const prettyMs = (ms: MsDuration): string => {
  const date = DayJs.of(MsDuration.unwrap(ms))
  const zero = DayJs.of(0)

  const d = pipe(date, DayJs.diff(zero, 'days'))
  const h = DayJs.hour.get(date)
  const m = DayJs.minute.get(date)
  const s = DayJs.second.get(date)
  const ms_ = DayJs.millisecond.get(date)

  if (d !== 0) return `${d}d${pad10(h)}h${pad10(m)}'${pad10(s)}.${pad100(ms_)}"`
  if (h !== 0) return `${pad10(h)}h${pad10(m)}'${pad10(s)}.${pad100(ms_)}"`
  if (m !== 0) return `${pad10(m)}'${pad10(s)}.${pad100(ms_)}"`
  return `${pad10(s)}.${pad100(ms_)}"`
}

const isUnicodeLetter = (c: string): boolean => c.toLowerCase() !== c.toUpperCase()
const isUpperCase = (c: string): boolean => c.toUpperCase() === c
const isLowerCase = (c: string): boolean => c.toLowerCase() === c

const upperOrLower: NonEmptyArray<(c: string) => string> = [
  c => c.toUpperCase(),
  c => c.toLowerCase(),
]
const randomCaseChar = (c: string): string => random.randomElem(upperOrLower)()(c)

// TODO: io.IO<string>
const randomCase = (str: string): string =>
  pipe(
    str.split(''),
    List.reduce('', (acc, c) => {
      if (!isUnicodeLetter(c)) return acc + c

      if (acc.length < 2) return acc + randomCaseChar(c)

      const a = acc.charAt(acc.length - 2)
      const b = acc.charAt(acc.length - 1)

      if (!isUnicodeLetter(a) || !isUnicodeLetter(b)) return acc + randomCaseChar(c)

      if (isUpperCase(a) && isUpperCase(b)) return acc + c.toLowerCase()
      if (isLowerCase(a) && isLowerCase(b)) return acc + c.toUpperCase()

      return acc + randomCaseChar(c)
    }),
  )

const booleanLabel = (bool: boolean): string => (bool ? 'Oui' : 'Non')

export const StringUtils = {
  ellipse,
  matcher1,
  matcher2,
  padStart,
  cleanUTF8ToASCII,
  reverse,
  prettyMs,
  randomCase,
  stripMargins,
  booleanLabel,
}
