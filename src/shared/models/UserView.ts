import type { User } from 'discord.js'
import * as C from 'io-ts/Codec'

import { Maybe } from '../utils/fp'
import { DiscordUserId } from './DiscordUserId'

const codec = C.struct({
  id: DiscordUserId.codec,
  tag: C.string,
  avatar: Maybe.codec(C.string),
})

export type UserView = C.TypeOf<typeof codec>

const fromUser = (u: User): UserView => ({
  id: DiscordUserId.fromUser(u),
  tag: u.tag,
  avatar: Maybe.fromNullable(u.displayAvatarURL({ dynamic: true })),
})

export const UserView = { fromUser, codec }
