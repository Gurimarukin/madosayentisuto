import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import 'dayjs/locale/fr'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import { ord } from 'fp-ts'
import type { IO } from 'fp-ts/IO'
import type { Ord } from 'fp-ts/Ord'

import { MsDuration } from '../../shared/models/MsDuration'

/* eslint-disable functional/no-expression-statement */
dayjs.extend(customParseFormat)
dayjs.extend(utc)
dayjs.locale('fr')
/* eslint-enable functional/no-expression-statement */

const now: IO<Dayjs> = dayjs

const parse = (value: string, format: string): Dayjs => dayjs(value, format, 'fr', true)

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

export const DateUtils = { now, parse, add, subtract, diff, Ord: Ord_, is8am }
