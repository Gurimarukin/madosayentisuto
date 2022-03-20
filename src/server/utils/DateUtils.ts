import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import customParseFormat from 'dayjs/plugin/customParseFormat'

import { MsDuration } from '../../shared/models/MsDuration'

/* eslint-disable functional/no-expression-statement */
dayjs.extend(customParseFormat)
dayjs.locale('fr')
/* eslint-enable functional/no-expression-statement */

const parse = (value: string, format: string): dayjs.Dayjs => dayjs(value, format, 'fr', true)

const plusDuration =
  (ms: MsDuration) =>
  (date: Date): Date =>
    new Date(date.getTime() + MsDuration.unwrap(ms))

const minusDuration: (ms: MsDuration) => (date: Date) => Date =
  (ms: MsDuration) =>
  (date: Date): Date =>
    new Date(date.getTime() - MsDuration.unwrap(ms))

export const DateUtils = { parse, plusDuration, minusDuration }
