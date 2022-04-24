import { predicate } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import type { StringValue } from 'ms'
import ms from 'ms'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { Maybe } from '../utils/fp'

export type MsDuration = Newtype<{ readonly MsDuration: unique symbol }, number>

const { wrap, unwrap } = iso<MsDuration>()

const fromString = (str: string): Maybe<MsDuration> =>
  pipe(
    Maybe.tryCatch(() => ms(str as StringValue)),
    Maybe.filter(predicate.not(isNaN)),
    Maybe.map(wrap),
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
}
