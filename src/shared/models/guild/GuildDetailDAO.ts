import type { Guild } from 'discord.js'
import * as C from 'io-ts/Codec'

import { List, Maybe } from '../../utils/fp'
import { GuildEmojiDAO } from './GuildEmojiDAO'
import { GuildId } from './GuildId'

const codec = C.struct({
  id: GuildId.codec,
  name: C.string,
  icon: Maybe.codec(C.string),
  emojis: List.codec(GuildEmojiDAO.codec),
})

const fromGuild = (g: Guild): GuildDetailDAO => ({
  id: GuildId.wrap(g.id),
  name: g.name,
  icon: Maybe.fromNullable(g.iconURL()),
  emojis: g.emojis.cache.toJSON().map(GuildEmojiDAO.fromGuildEmoji),
})

export type GuildDetailDAO = C.TypeOf<typeof codec>
export const GuildDetailDAO = { codec, fromGuild }
