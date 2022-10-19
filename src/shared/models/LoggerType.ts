import type { Dict, IO, NonEmptyArray, NotUsed } from '../utils/fp'
import type { LogLevel } from './log/LogLevel'

export type LoggerType = Dict<LogLevel, (...args: NonEmptyArray<unknown>) => IO<NotUsed>>
