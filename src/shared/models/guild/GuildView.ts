import type { Guild, GuildMember } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import type { Tuple } from '../../utils/fp'
import { List, Maybe } from '../../utils/fp'
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

const fromGuild = (
  guild: Guild,
  members: List<GuildMember>,
  birthdays: List<Tuple<UserId, Date>>,
): GuildView => ({
  id: GuildId.wrap(guild.id),
  name: guild.name,
  icon: Maybe.fromNullable(guild.iconURL({ dynamic: true })),
  members: pipe(members, List.map(MemberView.fromGuildMember(birthdays))),
  emojis: guild.emojis.cache.toJSON().map(GuildEmojiView.fromGuildEmoji),
})

export type GuildView = C.TypeOf<typeof codec>
export const GuildView = { codec, fromGuild }
