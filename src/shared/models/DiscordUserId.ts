import type { APIUser, User } from 'discord.js'
import type { eq } from 'fp-ts'
import { ord, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../utils/ioTsUtils'

export type DiscordUserId = Newtype<{ readonly DiscordUserId: unique symbol }, string>

const { wrap, unwrap } = iso<DiscordUserId>()

const fromUser = (user: APIUser | User): DiscordUserId => wrap(user.id)

const codec = fromNewtype<DiscordUserId>(C.string)

const Ord: ord.Ord<DiscordUserId> = pipe(string.Ord, ord.contramap(unwrap))
const Eq: eq.Eq<DiscordUserId> = Ord

export const DiscordUserId = { fromUser, unwrap, codec, Eq, Ord }
