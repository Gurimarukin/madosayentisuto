import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../../shared/utils/ioTsUtils'

type SummonerId = Newtype<{ readonly SummonerId: unique symbol }, string>

const { unwrap } = iso<SummonerId>()

const codec = fromNewtype<SummonerId>(C.string)

const Eq: eq.Eq<SummonerId> = pipe(string.Eq, eq.contramap(unwrap))

const SummonerId = { unwrap, codec, Eq }

export { SummonerId }
