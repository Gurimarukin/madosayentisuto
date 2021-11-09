import type { LogLevel } from 'bot/models/logger/LogLevel'
import type { IO, List } from 'shared/utils/fp'

export type LoggerType = Record<LogLevel, (arg: unknown, ...args: List<unknown>) => IO<void>>

export type LoggerGetter = (name: string) => LoggerType
