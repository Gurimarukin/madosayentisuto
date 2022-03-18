import { eq, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type MemberId = Newtype<{ readonly MemberId: unique symbol }, string>

const { wrap, unwrap } = iso<MemberId>()

const codec = fromNewtype<MemberId>(C.string)

const Eq: eq.Eq<MemberId> = pipe(string.Eq, eq.contramap(unwrap))

export const MemberId = { codec, wrap, Eq, unwrap }
