import * as C from 'io-ts/Codec'
import { Newtype, iso } from 'newtype-ts'

import { fromNewtype } from '../utils/fromNewType'

export type TSnowflake = Newtype<{ readonly TSnowflake: unique symbol }, string>

const isoTSnowflake = iso<TSnowflake>()

export namespace TSnowflake {
  export const wrap = isoTSnowflake.wrap
  export const unwrap = isoTSnowflake.unwrap
  export const codec = fromNewtype<TSnowflake>(C.string)
}
