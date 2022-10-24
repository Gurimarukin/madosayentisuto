import { Color } from '../../utils/Color'
import { createEnum } from '../../utils/createEnum'
import type { Dict } from '../../utils/fp'

const levelEnumWithoutTrace = createEnum('debug', 'info', 'warn', 'error')

type LogLevelWithoutTrace = typeof levelEnumWithoutTrace.T

const LogLevelWithoutTrace = {
  codec: levelEnumWithoutTrace.codec,
  values: levelEnumWithoutTrace.values,
}

const levelEnum = createEnum('trace', ...levelEnumWithoutTrace.values)

const shellColor: Dict<LogLevel, string> = {
  trace: '90',
  debug: '90',
  info: '36',
  warn: '33',
  error: '31;1',
}

const hexColor: Dict<LogLevel, Color> = {
  trace: Color.dimgray,
  debug: Color.dimgray,
  info: Color.lightseagreen,
  warn: Color.goldenrod,
  error: Color.tomato,
}

type LogLevel = typeof levelEnum.T

const LogLevel = {
  decoder: levelEnum.decoder,
  codec: levelEnum.codec,
  values: levelEnum.values,
  shellColor,
  hexColor,
}

const levelOrOffEnum = createEnum('off', ...levelEnum.values)

const value: Dict<LogLevelOrOff, number> = {
  trace: 5,
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
  off: 0,
}

type LogLevelOrOff = typeof levelOrOffEnum.T

const LogLevelOrOff = { codec: levelOrOffEnum.codec, value }

export { LogLevelWithoutTrace, LogLevel, LogLevelOrOff }
