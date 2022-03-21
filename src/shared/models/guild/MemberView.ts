import type { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { lens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { DateFromISOString } from '../../utils/ioTsUtils'
import { UserId } from './UserId'

const codec = C.struct({
  id: UserId.codec,
  name: C.string,
  color: C.string,
  avatar: Maybe.codec(C.string),
  birthdate: Maybe.codec(DateFromISOString.codec),
})

const fromGuildMember = (member: GuildMember): MemberView => ({
  id: UserId.wrap(member.user.id),
  name: member.displayName,
  color: member.displayHexColor,
  avatar: Maybe.fromNullable(member.user.displayAvatarURL({ dynamic: true })),
  birthdate: Maybe.none,
})

const Lens = {
  birthdate: pipe(lens.id<MemberView>(), lens.prop('birthdate')),
}

export type MemberView = C.TypeOf<typeof codec>
export const MemberView = { codec, fromGuildMember, Lens }
