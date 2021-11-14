import { pipe } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'
import type { List, Tuple } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'

const margin = /^\s*\|/gm
const stripMargins = (str: string): string => str.replace(margin, '')

const ellipse =
  (take: number) =>
  (str: string): string =>
    str.length > take ? `${str.substring(0, take)}...` : str

const isEmpty = (str: string): boolean => str === ''

const isString = (u: unknown): u is string => typeof u === 'string'

const matcher =
  <A>(regex: RegExp, f: (arr: RegExpMatchArray) => A) =>
  (str: string): Maybe<A> =>
    pipe(str.match(regex), Maybe.fromNullable, Maybe.map(f))

const matcher1 = (regex: RegExp): ((str: string) => Maybe<string>) =>
  matcher(regex, ([, a]) => a as string)

const matcher2 = (regex: RegExp): ((str: string) => Maybe<Tuple<string, string>>) =>
  matcher(regex, ([, a, b]) => [a, b] as Tuple<string, string>)

function mkString(sep: string): (list: List<string>) => string
function mkString(start: string, sep: string, end: string): (list: List<string>) => string
function mkString(startOrSep: string, sep?: string, end?: string): (list: List<string>) => string {
  return list =>
    sep !== undefined && end !== undefined
      ? `${startOrSep}${list.join(sep)}${end}`
      : list.join(startOrSep)
}

const prettyMs = (ms: MsDuration): string => {
  const d = new Date(Date.UTC(0, 0, 0, 0, 0, 0, MsDuration.unwrap(ms)))
  const h = Math.floor(MsDuration.unwrap(ms) / (1000 * 60 * 60))
  const m = d.getUTCMinutes()
  const s = d.getUTCSeconds()
  const ms_ = d.getUTCMilliseconds()
  return `${pad10(h)}:${pad10(m)}:${pad10(s)}.${pad100(ms_)}`
}

const pad10 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

const pad100 = (n: number): string => (n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`)

export const StringUtils = {
  ellipse,
  isEmpty,
  isString,
  matcher1,
  matcher2,
  mkString,
  pad10,
  pad100,
  prettyMs,
  stripMargins,
}
