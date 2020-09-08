import * as C from 'io-ts/Codec'
import { Newtype, iso } from 'newtype-ts'

import { fromNewtype } from '../utils/fromNewType'

export type GuildId = Newtype<{ readonly GuildId: unique symbol }, string>

const isoGuildId = iso<GuildId>()

export namespace GuildId {
  export const wrap = isoGuildId.wrap
  export const unwrap = isoGuildId.unwrap
  export const codec = fromNewtype<GuildId>(C.string)
}
