import { Newtype, iso } from 'newtype-ts'
import * as t from 'io-ts'
import { fromNewtype } from 'io-ts-types/lib/fromNewtype'

export type TSnowflake = Newtype<{ readonly Password: unique symbol }, string>

const isoTSnowflake = iso<TSnowflake>()

export namespace TSnowflake {
  export const wrap = isoTSnowflake.wrap
  export const unwrap = isoTSnowflake.unwrap
  export const codec = fromNewtype<TSnowflake>(t.string)
}
