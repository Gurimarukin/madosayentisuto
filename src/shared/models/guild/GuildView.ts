import type { Guild } from 'discord.js'
import * as C from 'io-ts/Codec'

import { List, Maybe } from '../../utils/fp'
import { GuildEmojiView } from './GuildEmojiView'
import { GuildId } from './GuildId'

const codec = C.struct({
  id: GuildId.codec,
  name: C.string,
  icon: Maybe.codec(C.string),
  emojis: List.codec(GuildEmojiView.codec),
})

const fromGuild = (g: Guild): GuildView => ({
  id: GuildId.wrap(g.id),
  name: g.name,
  icon: Maybe.fromNullable(g.iconURL()),
  emojis: g.emojis.cache.toJSON().map(GuildEmojiView.fromGuildEmoji),
})

export type GuildView = C.TypeOf<typeof codec>
export const GuildView = { codec, fromGuild }
