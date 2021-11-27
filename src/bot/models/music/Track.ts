import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/fromNewType'

export type Track = Newtype<{ readonly Track: unique symbol }, string>

const { wrap, unwrap } = iso<Track>()

const codec = fromNewtype<Track>(C.string)

export const Track = { codec, wrap, unwrap }
