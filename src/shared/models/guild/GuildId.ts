import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/fromNewType'

export type GuildId = Newtype<{ readonly GuildId: unique symbol }, string>

const { wrap, unwrap } = iso<GuildId>()

const codec = fromNewtype<GuildId>(C.string)

const Eq: eq.Eq<GuildId> = pipe(string.Eq, eq.contramap(unwrap))

export const GuildId = { codec, wrap, Eq, unwrap }
