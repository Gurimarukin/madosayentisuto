import type { GuildEmoji } from 'discord.js'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../utils/fp'
import { GuildEmojiId } from './GuildEmojiId'

const codec = C.struct({
  id: GuildEmojiId.codec,
  name: Maybe.codec(C.string),
  url: C.string,
})

const fromGuildEmoji = (e: GuildEmoji): GuildEmojiDAO => ({
  id: GuildEmojiId.wrap(e.id),
  name: Maybe.fromNullable(e.name),
  url: e.url,
})

export type GuildEmojiDAO = C.TypeOf<typeof codec>
export const GuildEmojiDAO = { codec, fromGuildEmoji }
