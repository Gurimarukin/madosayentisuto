import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../../shared/models/DayJs'
import { IO } from '../../../shared/utils/fp'

import { LogLevel } from '../../models/logger/LogLevel'
import type { LogFunction } from './LogFunction'

export const consoleLogFunction: LogFunction = (name, level, msg) =>
  pipe(DayJs.now, IO.fromIO, IO.map(flow(format(name, level, msg), console.log)))

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
