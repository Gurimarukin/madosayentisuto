import { option, predicate } from 'fp-ts'
import type { Option } from 'fp-ts/Option'
import { pipe } from 'fp-ts/function'
import type { StringValue } from 'ms'
import vercelMs from 'ms'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { StringUtils } from '../utils/StringUtils'
import { DayJs } from './DayJs'

const { padStart } = StringUtils

const pad10 = padStart(2)
const pad100 = padStart(3)

export type MsDuration = Newtype<{ readonly MsDuration: unique symbol }, number>

const { wrap, unwrap } = iso<MsDuration>()

const fromString = (str: string): Option<MsDuration> =>
  pipe(
    option.tryCatch(() => vercelMs(str as StringValue)),
    option.filter(predicate.not(isNaN)),
    option.map(wrap),
  )

const seconds = (n: number): MsDuration => wrap(1000 * n)
const minutes = (n: number): MsDuration => seconds(60 * n)
const hours = (n: number): MsDuration => minutes(60 * n)
const days = (n: number): MsDuration => hours(24 * n)

const fromDate = (date: Date): MsDuration => wrap(date.getTime())

const add =
  (b: MsDuration) =>
  (a: MsDuration): MsDuration =>
    wrap(unwrap(a) + unwrap(b))

const pretty = (ms: MsDuration): string => {
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

export const MsDuration = {
  wrap,
  unwrap,
  fromString,
  seconds,
  second: seconds,
  minutes,
  minute: minutes,
  hours,
  hour: hours,
  days,
  day: days,
  fromDate,
  add,
  pretty,
}
