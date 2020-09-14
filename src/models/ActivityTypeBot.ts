import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'

export namespace ActivityTypeBot {
  export const decoder = D.union(
    C.literal('PLAYING'),
    C.literal('STREAMING'),
    C.literal('LISTENING'),
    C.literal('WATCHING')
  )
  export const encoder = E.id<ActivityTypeBot>()
  export const codec = C.make(decoder, encoder)
}

export type ActivityTypeBot = D.TypeOf<typeof ActivityTypeBot.decoder>
