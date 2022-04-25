import type { BaseGuildTextChannel } from 'discord.js'
import * as C from 'io-ts/Codec'

import { ChannelId } from './ChannelId'

const codec = C.struct({
  id: ChannelId.codec,
  name: C.string,
})

export type ChannelView = C.TypeOf<typeof codec>

const fromChannel = (c: BaseGuildTextChannel): ChannelView => ({
  id: ChannelId.fromChannel(c),
  name: c.name,
})

export const ChannelView = { fromChannel, codec }
