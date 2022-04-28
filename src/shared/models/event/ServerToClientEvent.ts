import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { LogLevel } from '../log/LogLevel'

const commonCodec = C.struct({})

const logCodec = C.struct({
  type: C.literal('Log'),
  name: C.string,
  level: LogLevel.codec,
  message: C.string,
})

const codec = pipe(
  commonCodec,
  C.intersect(
    C.sum('type')({
      Log: logCodec,
    }),
  ),
)

export type ServerToClientEvent = C.TypeOf<typeof codec>

type Common = C.TypeOf<typeof commonCodec>

type Log = Common & C.TypeOf<typeof logCodec>

type LogArgs = Omit<Log, 'type'>

const Log = (args: LogArgs): Log => ({ type: 'Log', ...args })

export const ServerToClientEvent = { Log, codec }
