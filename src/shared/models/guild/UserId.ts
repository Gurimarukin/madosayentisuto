import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type UserId = Newtype<{ readonly UserId: unique symbol }, string>

const { wrap, unwrap } = iso<UserId>()

const codec = fromNewtype<UserId>(C.string)

const Eq: eq.Eq<UserId> = pipe(string.Eq, eq.contramap(unwrap))

export const UserId = { codec, wrap, Eq, unwrap }
