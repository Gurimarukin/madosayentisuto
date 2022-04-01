import type { IO } from '../../../shared/utils/fp'

import type { LogLevel } from './LogLevel'

export type LogFunction = (name: string, level: LogLevel, msg: string) => IO<void>
