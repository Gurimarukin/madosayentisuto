import * as C from 'io-ts/Codec'
import { Newtype, iso } from 'newtype-ts'

import { fromNewtype } from '../utils/fromNewType'

export type GuildId = Newtype<{ readonly GuildId: unique symbol }, string>

const { wrap, unwrap } = iso<GuildId>()

const codec = fromNewtype<GuildId>(C.string)

export const GuildId = { codec, wrap, unwrap }
