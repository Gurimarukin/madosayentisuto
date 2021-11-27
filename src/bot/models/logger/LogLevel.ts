import type { ColorResolvable } from 'discord.js'

import type { Dict } from '../../../shared/utils/fp'

import { Colors } from '../../constants'
import { createEnum } from '../../utils/createEnum'

const levelEnum = createEnum('debug', 'info', 'warn', 'error')
const { decoder } = levelEnum

const shellColor: Dict<LogLevel, string> = {
  debug: '90',
  info: '36',
  warn: '33',
  error: '31;1',
}

const hexColor: Dict<LogLevel, ColorResolvable> = {
  debug: Colors.dimgray,
  info: Colors.lightseagreen,
  warn: Colors.goldenrod,
  error: Colors.tomato,
}

export type LogLevel = typeof levelEnum.T

export const LogLevel = { decoder, shellColor, hexColor }

const levelOrOffEnum = createEnum('off', ...levelEnum.values)
const { codec } = levelOrOffEnum

const value: Dict<LogLevelOrOff, number> = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
  off: 0,
}

export type LogLevelOrOff = typeof levelOrOffEnum.T

export const LogLevelOrOff = { codec, value }
