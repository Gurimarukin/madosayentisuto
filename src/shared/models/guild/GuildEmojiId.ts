import type { GuildEmoji } from 'discord.js'
import * as C from 'io-ts/Codec'
import type { Newtype } from 'newtype-ts'
import { iso } from 'newtype-ts'

import { fromNewtype } from '../../utils/ioTsUtils'

export type GuildEmojiId = Newtype<{ readonly GuildEmojiId: unique symbol }, string>

const { wrap, unwrap } = iso<GuildEmojiId>()

const fromGuildEmoji = (guildEmoji: GuildEmoji): GuildEmojiId => wrap(guildEmoji.id)

const codec = fromNewtype<GuildEmojiId>(C.string)

export const GuildEmojiId = { fromGuildEmoji, unwrap, codec }
