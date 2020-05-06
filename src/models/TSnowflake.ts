import * as t from 'io-ts'
import { fromNewtype } from 'io-ts-types/lib/fromNewtype'
import { Newtype, iso } from 'newtype-ts'

export type TSnowflake = Newtype<{ readonly TSnowflake: unique symbol }, string>

const isoTSnowflake = iso<TSnowflake>()

export namespace TSnowflake {
  export const wrap = isoTSnowflake.wrap
  export const unwrap = isoTSnowflake.unwrap
  export const codec = fromNewtype<TSnowflake>(t.string)
}
