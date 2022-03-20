import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import 'dayjs/locale/fr'
import customParseFormatPlugin from 'dayjs/plugin/customParseFormat'
import utcPlugin from 'dayjs/plugin/utc'
import { ord } from 'fp-ts'
import type { IO } from 'fp-ts/IO'
import type { Ord } from 'fp-ts/Ord'

import { MsDuration } from '../models/MsDuration'

/* eslint-disable functional/no-expression-statement */
dayjs.extend(customParseFormatPlugin)
dayjs.extend(utcPlugin)
dayjs.locale('fr')
/* eslint-enable functional/no-expression-statement */

const of = dayjs

const now: IO<Dayjs> = dayjs

const utc = dayjs.utc

const parse = (value: string, format: string): Dayjs => utc(value, format, true)

const add =
  (ms: MsDuration) =>
  (date: Dayjs): Dayjs =>
    date.add(MsDuration.unwrap(ms), 'millisecond')

const subtract =
  (ms: MsDuration) =>
  (date: Dayjs): Dayjs =>
    date.subtract(MsDuration.unwrap(ms), 'millisecond')

const diff =
  (b: Dayjs) =>
  (a: Dayjs): MsDuration =>
    MsDuration.wrap(a.diff(b))

const Ord_: Ord<Dayjs> = ord.fromCompare((first, second) => {
  if (first.isSame(second)) return 0
  if (first.isBefore(second)) return -1
  return 1
})

const is8am = (d: Dayjs): boolean => d.hour() === 8 && d.minute() === 0

export const DateUtils = { of, now, utc, parse, add, subtract, diff, Ord: Ord_, is8am }
