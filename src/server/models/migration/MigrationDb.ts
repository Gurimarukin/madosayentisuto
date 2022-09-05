import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'

import { DayJsFromISOString } from '../../../shared/utils/ioTsUtils'

const createdAtCodec = C.struct({
  createdAt: DayJsFromISOString.codec,
})

const codec = pipe(
  createdAtCodec,
  C.intersect(
    C.struct({
      appliedAt: DayJsFromISOString.codec,
    }),
  ),
)

export type MigrationDb = C.TypeOf<typeof codec>

export const MigrationDb = { codec }

export const MigrationCreatedAt = {
  decoder: pipe(
    createdAtCodec,
    D.map(a => a.createdAt),
  ),
}
