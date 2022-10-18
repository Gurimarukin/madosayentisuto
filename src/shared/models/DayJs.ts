import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat'
import utcPlugin from 'dayjs/plugin/utc'
import type { eq } from 'fp-ts'
import { io, ord } from 'fp-ts'
import type { Endomorphism } from 'fp-ts/Endomorphism'
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

type OfOptions = {
  readonly locale?: boolean
}

function of(date: number | Date): DayJs
function of(date: string, format?: string, options?: OfOptions): DayJs
function of(
  date: number | Date | string,
  format?: string,
  { locale = false }: OfOptions = {},
): DayJs {
  return wrap((locale ? dayjs : dayjs.utc)(date, format, true))
}

const now: io.IO<DayJs> = pipe(dayjs.utc, io.map(wrap))

// tests

const isValid = (date: DayJs): boolean => unwrap(date).isValid()

const isHourSharp =
  (h: number) =>
  (date: DayJs): boolean =>
    hour.get(date) === h && minute.get(date) === 0

// modifiers

const add = (ms: MsDuration): Endomorphism<DayJs> =>
  modify(d => d.add(MsDuration.unwrap(ms), 'millisecond'))

const subtract = (ms: MsDuration): Endomorphism<DayJs> =>
  modify(d => d.subtract(MsDuration.unwrap(ms), 'millisecond'))

const startOf = (unit: dayjs.OpUnitType): Endomorphism<DayJs> => modify(d => d.startOf(unit))

// outputs

type FormatOptions = {
  readonly locale?: boolean
}

const format =
  (template?: string, { locale = false }: FormatOptions = {}) =>
  (date: DayJs): string => {
    const unwrapped = unwrap(date)

    return (locale ? unwrapped.local() : unwrapped).format(template)
  }

const toDate = (date: DayJs): Date => unwrap(date).toDate()
const toISOString = (date: DayJs): string => unwrap(date).toISOString()
const unix = (date: DayJs): number => unwrap(date).unix()
const unixMs = (date: DayJs): MsDuration => MsDuration.wrap(unwrap(date).valueOf())

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

const Ord: ord.Ord<DayJs> = ord.fromCompare((first, second) => {
  const f = unwrap(first)
  const s = unwrap(second)
  if (f.isSame(s)) return 0
  if (f.isBefore(s)) return -1
  return 1
})

// Eq

const Eq: eq.Eq<DayJs> = Ord

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
  isHourSharp,

  add,
  subtract,
  startOf,

  format,
  toDate,
  toISOString,
  unix,
  unixMs,
  diff,
  unwrap,

  Eq,
  Ord,

  year,
  month,
  date,
  day,
  hour,
  minute,
  second,
  millisecond,
}
