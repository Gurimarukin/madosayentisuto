import { pipe } from 'fp-ts/function'
import util from 'util'

import type { Tuple } from '../../../shared/utils/fp'
import { IO, NonEmptyArray, toUnit } from '../../../shared/utils/fp'

import type { LogFunction } from './LogFunction'
import { LogLevelOrOff } from './LogLevel'
import type { LogLevel } from './LogLevel'
import type { LoggerType } from './LoggerType'

export type LoggerGetter = (name: string) => LoggerType

const of = (...logFunctions: NonEmptyArray<Tuple<LogLevelOrOff, LogFunction>>): LoggerGetter => {
  return name => ({
    debug: (...params) => log(name, 'debug', util.format(...params)),
    info: (...params) => log(name, 'info', util.format(...params)),
    warn: (...params) => log(name, 'warn', util.format(...params)),
    error: (...params) => log(name, 'error', util.format(...params)),
  })

  function log(name: string, level: LogLevel, msg: string): IO<void> {
    return pipe(
      logFunctions,
      NonEmptyArray.traverse(IO.ApplicativePar)(([configLevel, f]) =>
        shouldLog(configLevel, level) ? f(name, level, msg) : IO.unit,
      ),
      IO.map(toUnit),
    )
  }
}

export const LoggerGetter = { of }

const shouldLog = (configLevel: LogLevelOrOff, level: LogLevel): boolean =>
  LogLevelOrOff.value[level] <= LogLevelOrOff.value[configLevel]
