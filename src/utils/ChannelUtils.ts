import { Channel, PartialTextBasedChannelFields } from 'discord.js'

export type SendableChannel = Channel & PartialTextBasedChannelFields

export namespace ChannelUtils {
  export const isSendable = (c: Channel): c is SendableChannel =>
    c.type === 'dm' || c.type == 'news' || c.type === 'text'
}
