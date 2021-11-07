import * as C from 'io-ts/Codec'
import { Newtype, iso } from 'newtype-ts'

import { fromNewtype } from '../utils/fromNewType'

export type CommandId = Newtype<{ readonly CommandId: unique symbol }, string>

const { wrap, unwrap } = iso<CommandId>()

const codec = fromNewtype<CommandId>(C.string)

export const CommandId = { codec, wrap, unwrap }
