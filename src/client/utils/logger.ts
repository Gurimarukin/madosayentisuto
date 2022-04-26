import type { LoggerType } from '../../shared/models/LoggerType'
import { IO } from '../../shared/utils/fp'

export const logger: LoggerType = {
  debug: (...params) => IO.fromIO(() => console.debug(...params)),
  info: (...params) => IO.fromIO(() => console.info(...params)),
  warn: (...params) => IO.fromIO(() => console.warn(...params)),
  error: (...params) => IO.fromIO(() => console.error(...params)),
}
