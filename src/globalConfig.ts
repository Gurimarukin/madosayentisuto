import { MsDuration } from './models/MsDuration'

const callsEmoji = '🔔' // :bell:

const retryEnsuringIndexes = MsDuration.minutes(5)

export const globalConfig = { callsEmoji, retryEnsuringIndexes }
