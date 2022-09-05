import type { Guild, GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import { lens, optional } from 'monocle-ts'
import type { Optional } from 'monocle-ts/Optional'

import { List, Maybe } from '../../utils/fp'
import type { DayJs } from '../DayJs'
import type { DiscordUserId } from '../DiscordUserId'
import { GuildEmojiView } from './GuildEmojiView'
import { GuildId } from './GuildId'
import { GuildStateView } from './GuildStateView'
import { GuildViewShort } from './GuildViewShort'
import { MemberView } from './MemberView'

type MemberIdWithBirthdate = {
  readonly id: DiscordUserId
  readonly birthdate: DayJs
}

const codec = pipe(
  GuildViewShort.codec,
  C.intersect(
    C.struct({
      state: GuildStateView.codec,
      members: List.codec(MemberView.codec),
      emojis: List.codec(GuildEmojiView.codec),
    }),
  ),
)

const fromGuild = (guild: Guild, state: GuildStateView, members: List<GuildMember>): GuildView => ({
  id: GuildId.fromGuild(guild),
  name: guild.name,
  state,
  icon: Maybe.fromNullable(guild.iconURL()),
  members: pipe(members, List.map(MemberView.fromGuildMember)),
  emojis: guild.emojis.cache.toJSON().map(GuildEmojiView.fromGuildEmoji),
})

const updateBirthdates =
  (birthdates: List<MemberIdWithBirthdate>) =>
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
  member: (member: DiscordUserId): Optional<GuildView, MemberView> =>
    pipe(
      lens.id<GuildView>(),
      lens.prop('members'),
      lens.findFirst(m => m.id === member),
    ),
}

export type GuildView = C.TypeOf<typeof codec>
export const GuildView = { codec, fromGuild, updateBirthdates, Lens }
