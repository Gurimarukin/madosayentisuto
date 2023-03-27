import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../../shared/utils/ioTsUtils'

// Champion's name, but without special chars

type ChampionId = Newtype<{ readonly ChampionId: unique symbol }, string>

const { unwrap } = iso<ChampionId>()

const codec = fromNewtype<ChampionId>(C.string)

const ChampionId = { unwrap, codec }

export { ChampionId }
