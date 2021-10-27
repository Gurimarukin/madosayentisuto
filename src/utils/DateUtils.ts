import { MsDuration } from '../models/MsDuration'

type MsFormat = {
  readonly year: number
  readonly month: number
  readonly day: number
  readonly hours: number
  readonly minutes: number
  readonly seconds: number
  readonly milliseconds: number
}

const msFormat = (ms: MsDuration): MsFormat => {
  const date = new Date(Date.UTC(0, 0, 0, 0, 0, 0, MsDuration.unwrap(ms)))

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDay(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
    seconds: date.getUTCSeconds(),
    milliseconds: date.getUTCMilliseconds(),
  }
}

export const DateUtils = { msFormat }
