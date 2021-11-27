import { MsDuration } from '../../shared/models/MsDuration'

const plusDuration =
  (ms: MsDuration) =>
  (date: Date): Date =>
    new Date(date.getTime() + MsDuration.unwrap(ms))

const minusDuration: (ms: MsDuration) => (date: Date) => Date =
  (ms: MsDuration) =>
  (date: Date): Date =>
    new Date(date.getTime() - MsDuration.unwrap(ms))

export const DateUtils = { plusDuration, minusDuration }
