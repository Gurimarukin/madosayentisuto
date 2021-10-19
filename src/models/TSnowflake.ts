import * as C from 'io-ts/Codec'
import { Newtype, iso } from 'newtype-ts'

import { fromNewtype } from '../utils/fromNewType'

export type TSnowflake = Newtype<{ readonly TSnowflake: unique symbol }, string>

const { wrap, unwrap } = iso<TSnowflake>()

const codec = fromNewtype<TSnowflake>(C.string)

export const TSnowflake = { codec, wrap, unwrap }
