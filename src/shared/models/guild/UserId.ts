import type { APIUser } from 'discord-api-types/v9'
import type { User } from 'discord.js'
import { eq, ord, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type UserId = Newtype<{ readonly UserId: unique symbol }, string>

const { wrap, unwrap } = iso<UserId>()

const fromUser = (user: APIUser | User): UserId => wrap(user.id)

const codec = fromNewtype<UserId>(C.string)

const Eq: eq.Eq<UserId> = pipe(string.Eq, eq.contramap(unwrap))
const Ord: ord.Ord<UserId> = pipe(string.Ord, ord.contramap(unwrap))

export const UserId = { fromUser, unwrap, codec, Eq, Ord }
