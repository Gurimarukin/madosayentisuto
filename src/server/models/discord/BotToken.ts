import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../../shared/utils/ioTsUtils'

type BotToken = Newtype<{ readonly BotToken: unique symbol }, string>

const { unwrap } = iso<BotToken>()

const codec = fromNewtype<BotToken>(C.string)

const BotToken = { unwrap, codec }

export { BotToken }
