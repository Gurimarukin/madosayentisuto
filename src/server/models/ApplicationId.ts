import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../shared/utils/ioTsUtils'

export type ApplicationId = Newtype<{ readonly ApplicationId: unique symbol }, string>

const { wrap, unwrap } = iso<ApplicationId>()

const codec = fromNewtype<ApplicationId>(C.string)

export const ApplicationId = { codec, wrap, unwrap }
