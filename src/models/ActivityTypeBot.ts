import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'

const decoder = D.union(
  C.literal('PLAYING'),
  C.literal('STREAMING'),
  C.literal('LISTENING'),
  C.literal('WATCHING'),
)

const encoder = E.id<ActivityTypeBot>()
const codec = C.make(decoder, encoder)

export type ActivityTypeBot = D.TypeOf<typeof decoder>

export const ActivityTypeBot = { decoder, encoder, codec }
