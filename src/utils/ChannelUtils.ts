import {
  Channel,
  PartialTextBasedChannelFields,
  DMChannel,
  TextChannel,
  GuildChannel
} from 'discord.js'

export type SendableChannel = Channel & PartialTextBasedChannelFields

export namespace ChannelUtils {
  export const isDm = (channel: Channel): channel is DMChannel => channel.type === 'dm'
  export const isText = (channel: Channel): channel is TextChannel => channel.type === 'text'

  export const isSendable = (c: Channel): c is SendableChannel =>
    c.type === 'dm' || c.type == 'news' || c.type === 'text'

  export const isPublic = (c: GuildChannel): boolean => c.permissionOverwrites.size === 0
  export const isPrivate = (c: GuildChannel): boolean => !isPublic(c)
}
