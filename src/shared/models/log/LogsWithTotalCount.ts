import * as C from 'io-ts/Codec'

import { List } from '../../utils/fp'
import { Log } from './Log'

const codec = C.struct({
  logs: List.codec(Log.apiCodec),
  totalCount: C.number,
})

export type LogsWithTotalCount = C.TypeOf<typeof codec>

export const LogsWithTotalCount = { codec }
