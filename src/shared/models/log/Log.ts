import * as C from 'io-ts/Codec'

import { DayJsFromISOString } from '../../utils/ioTsUtils'
import { LogLevelWithoutTrace } from './LogLevel'

const apiCodec = C.struct({
  date: DayJsFromISOString.codec,
  name: C.string,
  level: LogLevelWithoutTrace.codec,
  message: C.string,
})

type Log = C.TypeOf<typeof apiCodec>

const Log = { apiCodec }

export { Log }
