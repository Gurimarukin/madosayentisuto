import * as C from 'io-ts/Codec'

import { ClearPassword } from './ClearPassword'
import { UserName } from './UserName'

const codec = C.struct({
  userName: UserName.codec,
  password: ClearPassword.codec,
})

export type LoginPayload = C.TypeOf<typeof codec>

export const LoginPayload = { codec }
