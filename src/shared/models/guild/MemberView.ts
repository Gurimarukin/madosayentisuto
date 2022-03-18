import type { GuildMember } from 'discord.js'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../utils/fp'
import { MemberId } from './MemberId'

const codec = C.struct({
  id: MemberId.codec,
  name: C.string,
  color: C.string,
  avatar: Maybe.codec(C.string),
})

const fromGuildMember = (member: GuildMember): MemberView => ({
  id: MemberId.wrap(member.id),
  name: member.displayName,
  color: member.displayHexColor,
  avatar: Maybe.fromNullable(member.user.displayAvatarURL({ dynamic: true })),
})

export type MemberView = C.TypeOf<typeof codec>
export const MemberView = { codec, fromGuildMember }
