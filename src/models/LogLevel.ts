import * as D from 'io-ts/Decoder'

import { Colors } from '../utils/Colors'

export namespace LogLevel {
  export const decoder = D.union(
    D.literal('debug'),
    D.literal('info'),
    D.literal('warn'),
    D.literal('error'),
  )

  export const shellColor: Record<LogLevel, string> = {
    debug: '90',
    info: '36',
    warn: '33',
    error: '31;1',
  }

  export const hexColor: Record<LogLevel, string> = {
    debug: Colors.dimgray,
    info: Colors.lightseagreen,
    warn: Colors.goldenrod,
    error: Colors.tomato,
  }
}

export type LogLevel = D.TypeOf<typeof LogLevel.decoder>

export namespace LogLevelOrOff {
  export const codec = D.union(LogLevel.decoder, D.literal('off'))

  export const value: Record<LogLevelOrOff, number> = {
    debug: 4,
    info: 3,
    warn: 2,
    error: 1,
    off: 0,
  }
}

export type LogLevelOrOff = D.TypeOf<typeof LogLevelOrOff.codec>
