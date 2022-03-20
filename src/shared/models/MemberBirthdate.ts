import * as C from 'io-ts/Codec'

import { DateFromISOString } from '../utils/ioTsUtils'
import { UserId } from './guild/UserId'

const codec = C.struct({
  id: UserId.codec,
  birthdate: DateFromISOString.codec,
})

export type MemberBirthdate = C.TypeOf<typeof codec>
export type MemberBirthdateOutput = C.OutputOf<typeof codec>

export const MemberBirthdate = { codec }
