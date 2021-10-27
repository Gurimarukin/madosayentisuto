import { MsDuration } from '../models/MsDuration'

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

export const DateUtils = { msFormat }
