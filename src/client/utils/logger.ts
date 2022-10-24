import { pipe } from 'fp-ts/function'

import type { LoggerType } from '../../shared/models/LoggerType'
import { IO, toNotUsed } from '../../shared/utils/fp'

export const logger: LoggerType = {
  trace: log(console.trace),
  debug: log(console.debug),
  info: log(console.info),
  warn: log(console.warn),
  error: log(console.error),
}

function log(f: typeof console.log): LoggerType['info'] {
  return (...args) =>
    pipe(
      IO.fromIO(() => f(...args)),
      IO.map(toNotUsed),
    )
}
