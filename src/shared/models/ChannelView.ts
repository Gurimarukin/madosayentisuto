import * as C from 'io-ts/Codec'

import { ChannelId } from './ChannelId'

const codec = C.struct({
  id: ChannelId.codec,
  name: C.string,
})

export type ChannelView = C.TypeOf<typeof codec>
export const ChannelView = { codec }
