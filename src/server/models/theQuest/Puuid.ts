import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../../shared/utils/ioTsUtils'

type Puuid = Newtype<{ readonly Puuid: unique symbol }, string>

const { unwrap } = iso<Puuid>()

const codec = fromNewtype<Puuid>(C.string)

const Eq: eq.Eq<Puuid> = pipe(string.Eq, eq.contramap(unwrap))

const Puuid = { unwrap, codec, Eq }

export { Puuid }
