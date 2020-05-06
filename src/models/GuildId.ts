import * as t from 'io-ts'
import { fromNewtype } from 'io-ts-types/lib/fromNewtype'
import { Newtype, iso } from 'newtype-ts'

export type GuildId = Newtype<{ readonly GuildId: unique symbol }, string>

const isoGuildId = iso<GuildId>()

export namespace GuildId {
  export const wrap = isoGuildId.wrap
  export const unwrap = isoGuildId.unwrap
  export const codec = fromNewtype<GuildId>(t.string)
}
