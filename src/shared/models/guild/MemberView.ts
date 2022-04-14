import type { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { lens } from 'monocle-ts'

import { Maybe } from '../../utils/fp'
import { DayJsFromISOString } from '../../utils/ioTsUtils'
import { DiscordUserId } from '../DiscordUserId'

const codec = C.struct({
  id: DiscordUserId.codec,
  name: C.string,
  color: C.string,
  avatar: Maybe.codec(C.string),
  birthdate: Maybe.codec(DayJsFromISOString.codec),
})

const fromGuildMember = (member: GuildMember): MemberView => ({
  id: DiscordUserId.fromUser(member.user),
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
