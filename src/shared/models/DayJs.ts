import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat'
import utcPlugin from 'dayjs/plugin/utc'
import { io, ord } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
import type { IO } from 'fp-ts/IO'
import type { Ord } from 'fp-ts/Ord'
import { identity, pipe } from 'fp-ts/function'
import type { Lens } from 'monocle-ts/Lens'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { MsDuration } from './MsDuration'

/* eslint-disable functional/no-expression-statement */
dayjs.extend(customParseFormatPlugin)
dayjs.extend(utcPlugin)
dayjs.locale('fr')
/* eslint-enable functional/no-expression-statement */

export type DayJs = Newtype<{ readonly DayJs: unique symbol }, dayjs.Dayjs>

const { wrap, unwrap } = iso<DayJs>()
const modify = identity as (f: Endomorphism<dayjs.Dayjs>) => Endomorphism<DayJs>

// constructors

const of = (date: string | number | Date, format?: string): DayJs =>
  wrap(dayjs.utc(date, format, true))

const now: IO<DayJs> = pipe(dayjs, io.map(wrap))

// tests

const isValid = (date: DayJs): boolean => unwrap(date).isValid()

const is8am = (date: DayJs): boolean => {
  const d = unwrap(date)
  return d.hour() === 8 && d.minute() === 0
}

// modifiers

const add = (ms: MsDuration): Endomorphism<DayJs> =>
  modify(d => d.add(MsDuration.unwrap(ms), 'millisecond'))

const subtract = (ms: MsDuration): Endomorphism<DayJs> =>
  modify(d => d.subtract(MsDuration.unwrap(ms), 'millisecond'))

const startOf = (unit: dayjs.OpUnitType): Endomorphism<DayJs> => modify(d => d.startOf(unit))

// outputs

const format =
  (template?: string) =>
  (date: DayJs): string =>
    unwrap(date).format(template)

function diff(b: DayJs): (a: DayJs) => MsDuration
function diff(b: DayJs, unit: dayjs.QUnitType | dayjs.OpUnitType): (a: DayJs) => number
function diff(
  b: DayJs,
  unit?: dayjs.QUnitType | dayjs.OpUnitType,
): (a: DayJs) => MsDuration | number {
  return a =>
    unit === undefined
      ? MsDuration.wrap(unwrap(a).diff(unwrap(b)))
      : unwrap(a).diff(unwrap(b), unit)
}

// Ord

const Ord_: Ord<DayJs> = ord.fromCompare((first, second) => {
  const f = unwrap(first)
  const s = unwrap(second)
  if (f.isSame(s)) return 0
  if (f.isBefore(s)) return -1
  return 1
})

// Lens

const year: Lens<DayJs, number> = {
  get: d => unwrap(d).year(),
  set: n => modify(d => d.year(n)),
}

const month: Lens<DayJs, number> = {
  get: d => unwrap(d).month(),
  set: n => modify(d => d.month(n)),
}

// date of month
const date: Lens<DayJs, number> = {
  get: d => unwrap(d).date(),
  set: n => modify(d => d.date(n)),
}

// day of week
const day: Lens<DayJs, number> = {
  get: d => unwrap(d).day(),
  set: n => modify(d => d.day(n)),
}

const hour: Lens<DayJs, number> = {
  get: d => unwrap(d).hour(),
  set: n => modify(d => d.hour(n)),
}

const minute: Lens<DayJs, number> = {
  get: d => unwrap(d).minute(),
  set: n => modify(d => d.minute(n)),
}

const second: Lens<DayJs, number> = {
  get: d => unwrap(d).second(),
  set: n => modify(d => d.second(n)),
}

const millisecond: Lens<DayJs, number> = {
  get: d => unwrap(d).millisecond(),
  set: n => modify(d => d.millisecond(n)),
}

export const DayJs = {
  of,
  now,

  isValid,
  is8am,

  add,
  subtract,
  startOf,

  format,
  diff,
  unwrap,

  Ord: Ord_,

  year,
  month,
  date,
  day,
  hour,
  minute,
  second,
  millisecond,
}