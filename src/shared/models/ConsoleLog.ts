import * as C from 'io-ts/Codec'

import { DayJsFromISOString } from '../utils/ioTsUtils'
import { LogLevel } from './LogLevel'

const apiCodec = C.struct({
  date: DayJsFromISOString.codec,
  name: C.string,
  level: LogLevel.codec,
  message: C.string,
})

export type ConsoleLog = C.TypeOf<typeof apiCodec>

export const ConsoleLog = { apiCodec }
