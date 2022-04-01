import * as C from 'io-ts/Codec'

import { WebUserId } from './WebUserId'

const codec = C.struct({
  id: WebUserId.codec,
})

export type TokenContent = C.TypeOf<typeof codec>

export const TokenContent = { codec }
