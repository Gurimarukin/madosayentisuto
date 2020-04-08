import * as t from 'io-ts'

export type LogLevel = t.TypeOf<typeof LogLevel.codec>

export namespace LogLevel {
  export const codec = t.union([
    t.literal('debug'),
    t.literal('info'),
    t.literal('warn'),
    t.literal('error')
  ])

  export const shellColor: Record<LogLevel, string> = {
    debug: '90',
    info: '36',
    warn: '33',
    error: '31;1'
  }

  export const hexColor: Record<LogLevel, string> = {
    debug: '686a66',
    info: '00a4a8',
    warn: 'c8a800',
    error: 'f54234'
  }
}

export type LogLevelOrOff = t.TypeOf<typeof LogLevelOrOff.codec>

export namespace LogLevelOrOff {
  export const codec = t.union([LogLevel.codec, t.literal('off')])

  export const value: Record<LogLevelOrOff, number> = {
    debug: 4,
    info: 3,
    warn: 2,
    error: 1,
    off: 0
  }
}
