import { Channel, GuildChannel, TextChannel, VoiceChannel } from 'discord.js'
import { predicate } from 'fp-ts'

// export type SendableChannel = Channel & PartialTextBasedChannelFields

// const isDm = (channel: GuildChannel | ThreadChannel): channel is DMChannel => channel.type === 'dm'

// const isSendable = (c: Channel): c is SendableChannel =>
//   c.type === 'dm' || c.type == 'news' || c.type === 'text'

const isGuildChannel = (channel: Channel): channel is GuildChannel =>
  channel instanceof GuildChannel

const isTextChannel = (channel: Channel): channel is TextChannel => channel instanceof TextChannel

const isVoiceChannel = (channel: Channel): channel is VoiceChannel =>
  channel instanceof VoiceChannel

const isPublic = (channel: GuildChannel): boolean =>
  channel.permissionOverwrites.valueOf().size === 0

const isPrivate = predicate.not(isPublic)

export const ChannelUtils = { isGuildChannel, isTextChannel, isVoiceChannel, isPublic, isPrivate }
