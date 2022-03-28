import * as C from 'io-ts/Codec'

import { ChannelId } from '../ChannelId'
import { MessageId } from '../MessageId'

const codec = C.struct({
  thread: ChannelId.codec,
  message: MessageId.codec,
})

export type ThreadWithMessage = C.TypeOf<typeof codec>

export const ThreadWithMessage = { codec }
