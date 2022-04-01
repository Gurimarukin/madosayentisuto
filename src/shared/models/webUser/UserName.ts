import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type UserName = Newtype<{ readonly UserName: unique symbol }, string>

const { wrap, unwrap } = iso<UserName>()

const codec = fromNewtype<UserName>(C.string)

export const UserName = { wrap, unwrap, codec }
