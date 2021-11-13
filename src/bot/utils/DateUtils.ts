import { flow } from 'fp-ts/function'

import { MsDuration } from '../../shared/models/MsDuration'

type MsFormat = {
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
  readonly milliseconds: number
}

const msFormat = (ms: MsDuration): MsFormat => {
  const date = new Date(Date.UTC(0, 0, 0, 0, 0, 0, MsDuration.unwrap(ms)))

  const hours = Math.floor(MsDuration.unwrap(ms) / (1000 * 60 * 60))

  return {
    hours,
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
  }
}

const plusDuration =
  (ms: MsDuration) =>
  (date: Date): Date =>
    new Date(date.getTime() + MsDuration.unwrap(ms))

const minusDuration: (ms: MsDuration) => (date: Date) => Date = flow(
  MsDuration.modify(n => -n),
  plusDuration,
)

export const DateUtils = { msFormat, plusDuration, minusDuration }
