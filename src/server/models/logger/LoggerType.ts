import type { IO, NonEmptyArray } from '../../../shared/utils/fp'

import type { LogLevel } from './LogLevel'

export type LoggerType = Record<LogLevel, (...args: NonEmptyArray<unknown>) => IO<void>>
