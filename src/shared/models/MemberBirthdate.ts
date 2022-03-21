import * as C from 'io-ts/Codec'

import { DayJs } from './DayJs'
import { UserId } from './guild/UserId'

const codec = C.struct({
  id: UserId.codec,
  birthdate: DayJs.codec,
})

export type MemberBirthdate = C.TypeOf<typeof codec>
export type MemberBirthdateOutput = C.OutputOf<typeof codec>

export const MemberBirthdate = { codec }
