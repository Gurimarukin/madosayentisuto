import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../../shared/utils/ioTsUtils'

export type HashedPassword = Newtype<{ readonly HashedPassword: unique symbol }, string>

const { wrap, unwrap } = iso<HashedPassword>()

const codec = fromNewtype<HashedPassword>(C.string)

export const HashedPassword = { wrap, unwrap, codec }
