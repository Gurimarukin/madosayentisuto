import { MsDuration } from './models/MsDuration'

export const globalConfig = {
  callsEmoji: '🔔', // :bell:

  retryEnsuringIndexes: MsDuration.minutes(5),

  cronJob: {
    hour: 8, // 8 am
    interval: MsDuration.days(1),
  },
}
