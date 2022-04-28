import type { Dict, IO, NonEmptyArray } from '../utils/fp'
import type { LogLevel } from './log/LogLevel'

export type LoggerType = Dict<LogLevel, (...args: NonEmptyArray<unknown>) => IO<void>>
