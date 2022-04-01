import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type ClearPassword = Newtype<{ readonly ClearPassword: unique symbol }, string>

const { wrap, unwrap } = iso<ClearPassword>()

const codec = fromNewtype<ClearPassword>(C.string)

export const ClearPassword = { wrap, unwrap, codec }
