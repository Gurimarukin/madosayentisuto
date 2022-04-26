import { Color } from '../utils/Color'
import { createEnum } from '../utils/createEnum'
import type { Dict } from '../utils/fp'

const levelEnum = createEnum('debug', 'info', 'warn', 'error')

const shellColor: Dict<LogLevel, string> = {
  debug: '90',
  info: '36',
  warn: '33',
  error: '31;1',
}

const hexColor: Dict<LogLevel, Color> = {
  debug: Color.dimgray,
  info: Color.lightseagreen,
  warn: Color.goldenrod,
  error: Color.tomato,
}

export type LogLevel = typeof levelEnum.T

export const LogLevel = {
  decoder: levelEnum.decoder,
  codec: levelEnum.codec,
  values: levelEnum.values,
  shellColor,
  hexColor,
}

const levelOrOffEnum = createEnum('off', ...levelEnum.values)

const value: Dict<LogLevelOrOff, number> = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
  off: 0,
}

export type LogLevelOrOff = typeof levelOrOffEnum.T

export const LogLevelOrOff = { codec: levelOrOffEnum.codec, value }
