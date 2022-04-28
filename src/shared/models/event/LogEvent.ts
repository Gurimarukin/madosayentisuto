import * as C from 'io-ts/Codec'

import { LogLevel, LogLevelOrOff } from '../log/LogLevel'

const codec = C.struct({
  name: C.string,
  level: LogLevel.codec,
  message: C.string,
})

export type LogEvent = C.TypeOf<typeof codec>

export const LogEvent = {
  filter:
    (configLevel: LogLevelOrOff) =>
    (event: LogEvent): boolean =>
      LogLevelOrOff.value[event.level] <= LogLevelOrOff.value[configLevel],
  codec,
}
