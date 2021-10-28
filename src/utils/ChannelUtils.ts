import { GuildChannel, TextChannel, ThreadChannel } from 'discord.js'

// export type SendableChannel = Channel & PartialTextBasedChannelFields

// const isDm = (channel: GuildChannel | ThreadChannel): channel is DMChannel => channel.type === 'dm'
// const isText = (channel: GuildChannel | ThreadChannel): channel is TextChannel => channel.type === 'text'
// const isVoice = (channel: GuildChannel | ThreadChannel): channel is VoiceChannel => channel.type === 'voice'

// const isSendable = (c: Channel): c is SendableChannel =>
//   c.type === 'dm' || c.type == 'news' || c.type === 'text'

// const isPublic = (c: GuildChannel): boolean => c.permissionOverwrites.size === 0
// const isPrivate = predicate.not(isPublic)

const isTextChannel = (channel: GuildChannel | ThreadChannel): channel is TextChannel =>
  channel instanceof TextChannel

export const ChannelUtils = { isTextChannel }
