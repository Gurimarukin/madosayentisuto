import type { Guild, GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { lens, optional } from 'monocle-ts'
import type { Optional } from 'monocle-ts/Optional'

import { List, Maybe } from '../../utils/fp'
import type { MemberBirthdate } from '../MemberBirthdate'
import { GuildEmojiView } from './GuildEmojiView'
import { GuildId } from './GuildId'
import { MemberView } from './MemberView'
import type { UserId } from './UserId'

const codec = C.struct({
  id: GuildId.codec,
  name: C.string,
  icon: Maybe.codec(C.string),
  members: List.codec(MemberView.codec),
  emojis: List.codec(GuildEmojiView.codec),
})

const fromGuild = (guild: Guild, members: List<GuildMember>): GuildView => ({
  id: GuildId.wrap(guild.id),
  name: guild.name,
  icon: Maybe.fromNullable(guild.iconURL({ dynamic: true })),
  members: pipe(members, List.map(MemberView.fromGuildMember)),
  emojis: guild.emojis.cache.toJSON().map(GuildEmojiView.fromGuildEmoji),
})

const updateBirthdates =
  (birthdates: List<MemberBirthdate>) =>
  (guild: GuildView): GuildView =>
    pipe(
      birthdates,
      List.reduce(guild, (acc, m) =>
        pipe(
          Lens.member(m.id),
          optional.modify(MemberView.Lens.birthdate.set(Maybe.some(m.birthdate))),
        )(acc),
      ),
    )

const Lens = {
  member: (member: UserId): Optional<GuildView, MemberView> =>
    pipe(
      lens.id<GuildView>(),
      lens.prop('members'),
      lens.findFirst(m => m.id === member),
    ),
}

export type GuildView = C.TypeOf<typeof codec>
export const GuildView = { codec, fromGuild, updateBirthdates, Lens }
