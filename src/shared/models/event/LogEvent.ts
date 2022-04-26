import * as C from 'io-ts/Codec'

import { LogLevel } from '../LogLevel'

const codec = C.struct({
  name: C.string,
  level: LogLevel.codec,
  message: C.string,
})

export type LogEvent = C.TypeOf<typeof codec>

export const LogEvent = { codec }
