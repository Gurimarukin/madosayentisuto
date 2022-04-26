import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

const commonCodec = C.struct({})

const dummyEventCodec = C.struct({
  type: C.literal('Dummy'),
  a: C.number,
})

const codec = pipe(
  commonCodec,
  C.intersect(
    C.sum('type')({
      Dummy: dummyEventCodec,
    }),
  ),
)

export type ClientToServerEvent = C.TypeOf<typeof codec>

type Common = C.TypeOf<typeof commonCodec>

type Dummy = Common & C.TypeOf<typeof dummyEventCodec>

type DummyArgs = Omit<Dummy, 'type'>

const Dummy = (args: DummyArgs): Dummy => ({ type: 'Dummy', ...args })

export const ClientToServerEvent = { Dummy, codec }
