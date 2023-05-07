import { pipe } from 'fp-ts/function'
import type { Codec } from 'io-ts/Codec'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'
import * as E from 'io-ts/Encoder'

import { CustomId, NumberFromString } from '../../utils/ioTsUtils'

export type PollButton = {
  choiceIndex: number
}

const of = (choiceIndex: number): PollButton => ({ choiceIndex })

const rawCodec = CustomId.codec('poll')

const codec: Codec<string, string, PollButton> = C.make(
  pipe(rawCodec, D.parse(NumberFromString.decoder.decode), D.map(of)),
  pipe(
    rawCodec,
    E.contramap(b => NumberFromString.encoder.encode(b.choiceIndex)),
  ),
)

export const PollButton = { of, codec }
