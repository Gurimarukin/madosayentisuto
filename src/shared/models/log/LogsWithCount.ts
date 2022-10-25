import * as C from 'io-ts/Codec'

import { List } from '../../utils/fp'
import { Log } from './Log'

const codec = C.struct({
  logs: List.codec(Log.apiCodec),
  count: C.number,
})

type LogsWithCount = C.TypeOf<typeof codec>
const LogsWithCount = { codec }

export { LogsWithCount }
