import { either, option, predicate } from 'fp-ts'
import type { Option } from 'fp-ts/Option'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import type { StringValue } from '../lib/ms'
import { ms as vercelMs } from '../lib/ms'

type MsDuration = Newtype<{ readonly MsDuration: unique symbol }, number>

const { wrap: ms, unwrap } = iso<MsDuration>()

const decoder = pipe(
  D.string,
  D.parse(str =>
    pipe(
      fromString(str),
      either.fromOption(() => D.error(str, 'MsDuration')),
    ),
  ),
)

const fromString = (str: string): Option<MsDuration> =>
  pipe(
    option.tryCatch(() => vercelMs(str as StringValue)),
    option.filter(predicate.not(isNaN)),
    option.map(ms),
  )

const seconds = (n: number): MsDuration => ms(1000 * n)
const minutes = (n: number): MsDuration => seconds(60 * n)
const hours = (n: number): MsDuration => minutes(60 * n)
const days = (n: number): MsDuration => hours(24 * n)

const fromDate = (date: Date): MsDuration => ms(date.getTime())

const add =
  (b: MsDuration) =>
  (a: MsDuration): MsDuration =>
    ms(unwrap(a) + unwrap(b))

const MsDuration = {
  ms,
  unwrap,
  decoder,
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

export { MsDuration }
