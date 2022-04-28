import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../../shared/models/DayJs'
import type { LogEvent } from '../../../../shared/models/event/LogEvent'
import { LogLevel } from '../../../../shared/models/log/LogLevel'
import type { TObserver } from '../../../../shared/models/rx/TObserver'
import { Future } from '../../../../shared/utils/fp'

export const ConsoleLogObserver: TObserver<LogEvent> = {
  next: ({ name, level, message }) =>
    pipe(DayJs.now, Future.fromIO, Future.map(flow(format(name, level, message), console.log))),
}

const format =
  (name: string, level: LogLevel, msg: string) =>
  (now: DayJs): string => {
    const withName = `${name} - ${msg}`
    const withTimestamp = `${color(formatDate(now), '30;1')} ${withName}`
    const c = LogLevel.shellColor[level]
    return level === 'info' || level === 'warn'
      ? `${color(level.toUpperCase(), c)}  ${withTimestamp}`
      : `${color(level.toUpperCase(), c)} ${withTimestamp}`
  }

const color = (s: string, c: string): string => (process.stdout.isTTY ? `\x1B[${c}m${s}\x1B[0m` : s)

const formatDate: (d: DayJs) => string = DayJs.format('YYYY/MM/DD HH:mm:ss')
