import { Channel, PartialTextBasedChannelFields, DMChannel, TextChannel } from 'discord.js'

export type SendableChannel = Channel & PartialTextBasedChannelFields

export namespace ChannelUtils {
  export const isDm = (channel: Channel): channel is DMChannel => channel.type === 'dm'
  export const isText = (channel: Channel): channel is TextChannel => channel.type === 'text'

  export const isSendable = (c: Channel): c is SendableChannel =>
    c.type === 'dm' || c.type == 'news' || c.type === 'text'
}
