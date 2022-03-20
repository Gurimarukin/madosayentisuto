import * as C from 'io-ts/Codec'

import { UserId } from '../../shared/models/guild/UserId'
import { DateFromISOString } from '../../shared/utils/ioTsUtils'

const codec = C.struct({
  id: UserId.codec,
  birthdate: DateFromISOString.codec,
})

export type MemberBirthdate = C.TypeOf<typeof codec>
export type MemberBirthdateOutput = C.OutputOf<typeof codec>

export const MemberBirthdate = { codec }
