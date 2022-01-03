import type { IO, List } from '../../../shared/utils/fp'

import type { LogLevel } from './LogLevel'

export type LoggerType = Record<LogLevel, (arg: unknown, ...args: List<unknown>) => IO<void>>

export type LoggerGetter = (name: string) => LoggerType
