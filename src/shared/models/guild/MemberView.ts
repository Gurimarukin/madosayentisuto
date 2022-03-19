import type { GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { lens } from 'monocle-ts'

import { Tuple } from '../../utils/fp'
import { List, Maybe } from '../../utils/fp'
import { DateFromISOString } from '../../utils/ioTsUtils'
import { UserId } from './UserId'

const codec = C.struct({
  id: UserId.codec,
  name: C.string,
  color: C.string,
  avatar: Maybe.codec(C.string),
  birthday: Maybe.codec(DateFromISOString.codec),
})

const fromGuildMember =
  (birthdays: List<Tuple<UserId, Date>>) =>
  (member: GuildMember): MemberView => {
    const userId = UserId.wrap(member.user.id)
    return {
      id: userId,
      name: member.displayName,
      color: member.displayHexColor,
      avatar: Maybe.fromNullable(member.user.displayAvatarURL({ dynamic: true })),
      birthday: pipe(
        birthdays,
        List.findFirst(([id]) => id === userId),
        Maybe.map(Tuple.snd),
      ),
    }
  }

const Lens = {
  birthday: pipe(lens.id<MemberView>(), lens.prop('birthday')),
}

export type MemberView = C.TypeOf<typeof codec>
export const MemberView = { codec, fromGuildMember, Lens }
