import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'

import { Birthdate } from './Birthdate'

const codec = C.struct({
  id: DiscordUserId.codec,
  birthdate: Birthdate.codec,
})

export type MemberBirthdate = C.TypeOf<typeof codec>
export type MemberBirthdateOutput = C.OutputOf<typeof codec>

export const MemberBirthdate = { codec }
