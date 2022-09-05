import * as C from 'io-ts/Codec'

import { UserName } from '../../../shared/models/webUser/UserName'

import { HashedPassword } from './HashedPassword'
import { WebUserId } from './WebUserId'

const codec = C.struct({
  id: WebUserId.codec,
  userName: UserName.codec,
  password: HashedPassword.codec,
})

const of = (id: WebUserId, userName: UserName, password: HashedPassword): WebUser => ({
  id,
  userName,
  password,
})

export type WebUser = C.TypeOf<typeof codec>

export const WebUser = { codec, of }
