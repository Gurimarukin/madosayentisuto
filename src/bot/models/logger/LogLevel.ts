import type { ColorResolvable } from 'discord.js'
import * as D from 'io-ts/Decoder'

import type { Dict } from 'shared/utils/fp'

import { Colors } from 'bot/constants'

const decoder = D.union(
  D.literal('debug'),
  D.literal('info'),
  D.literal('warn'),
  D.literal('error'),
)

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

export type LogLevel = D.TypeOf<typeof decoder>

export const LogLevel = { decoder, shellColor, hexColor }

const codec = D.union(LogLevel.decoder, D.literal('off'))

const value: Dict<LogLevelOrOff, number> = {
  debug: 4,
  info: 3,
  warn: 2,
  error: 1,
  off: 0,
}

export type LogLevelOrOff = D.TypeOf<typeof codec>

export const LogLevelOrOff = { codec, value }
