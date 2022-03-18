import type { Guild } from 'discord.js'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../utils/fp'
import { GuildId } from './GuildId'

const codec = C.struct({
  id: GuildId.codec,
  name: C.string,
  icon: Maybe.codec(C.string),
})

const fromGuild = (g: Guild): GuildViewShort => ({
  id: GuildId.wrap(g.id),
  name: g.name,
  icon: Maybe.fromNullable(g.iconURL()),
})

export type GuildViewShort = C.TypeOf<typeof codec>
export const GuildViewShort = { codec, fromGuild }
