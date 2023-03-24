import * as C from 'io-ts/Codec'

import { Platform } from './Platform'

type Summoner = Readonly<C.TypeOf<typeof codec>>

const codec = C.struct({
  platform: Platform.codec,
  name: C.string,
})

const Summoner = { codec }

export { Summoner }
