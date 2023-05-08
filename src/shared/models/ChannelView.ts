import * as C from 'io-ts/Codec'

import { Maybe } from '../utils/fp'
import { ChannelId } from './ChannelId'

type ChannelView = C.TypeOf<typeof codec>

const codec = C.struct({
  id: ChannelId.codec,
  name: Maybe.codec(C.string),
})

const ChannelView = { codec }

export { ChannelView }
