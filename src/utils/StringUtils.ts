import { pipe } from 'fp-ts/function'

import { List, Maybe, Tuple } from './fp'

const margin = /^\s*\|/gm

export const isEmpty = (str: string): boolean => str === ''

export const isString = (u: unknown): u is string => typeof u === 'string'

export const stripMargins = (str: string): string => str.replace(margin, '')

export function mkString(sep: string): (list: List<string>) => string
export function mkString(start: string, sep: string, end: string): (list: List<string>) => string
export function mkString(
  startOrSep: string,
  sep?: string,
  end?: string,
): (list: List<string>) => string {
  return list =>
    sep !== undefined && end !== undefined
      ? `${startOrSep}${list.join(sep)}${end}`
      : list.join(startOrSep)
}

export const ellipse =
  (take: number) =>
  (str: string): string =>
    str.length > take ? `${str.substring(0, take)}...` : str

const matcher =
  <A>(regex: RegExp, f: (arr: RegExpMatchArray) => A) =>
  (str: string): Maybe<A> =>
    pipe(str.match(regex), Maybe.fromNullable, Maybe.map(f))

export const matcher1 = (regex: RegExp): ((str: string) => Maybe<string>) =>
  matcher(regex, ([, a]) => a as string)

export const matcher2 = (regex: RegExp): ((str: string) => Maybe<Tuple<string, string>>) =>
  matcher(regex, ([, a, b]) => [a, b] as Tuple<string, string>)

export const StringUtils = {
  isEmpty,
  isString,
  stripMargins,
  mkString,
  ellipse,
  matcher1,
  matcher2,
}
