import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Codec } from 'io-ts/Codec'
import type { Decoder } from 'io-ts/Decoder'
import * as D from 'io-ts/Decoder'
import type { Encoder } from 'io-ts/Encoder'

import { DayJs } from '../../../shared/models/DayJs'

const rawCodec = C.struct({
  year: C.number,
  month: C.number,
  date: C.number,
})

const fromDate = (date: DayJs): Birthdate => ({
  year: DayJs.year.get(date),
  month: DayJs.month.get(date),
  date: DayJs.date.get(date),
})

const decoder: Decoder<unknown, DayJs> = pipe(
  rawCodec,
  D.parse(raw => {
    const { year, month, date } = raw
    const d = pipe(DayJs.of(0), DayJs.year.set(year), DayJs.month.set(month), DayJs.date.set(date))
    return DayJs.isValid(d) ? D.success(d) : D.failure(raw, 'Birthdate')
  }),
)

const encoder: Encoder<BirthdateOutput, DayJs> = { encode: fromDate }

const codec: Codec<unknown, BirthdateOutput, DayJs> = C.make(decoder, encoder)

export type Birthdate = C.TypeOf<typeof rawCodec>
export type BirthdateOutput = C.OutputOf<typeof rawCodec>

export const Birthdate = { fromDate, decoder, encoder, codec }
