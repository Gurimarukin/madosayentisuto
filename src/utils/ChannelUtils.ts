// import {
//   Channel,
//   DMChannel,
//   GuildChannel,
//   PartialTextBasedChannelFields,
//   TextChannel,
//   VoiceChannel,
// } from 'discord.js'
// import { predicate } from 'fp-ts'

// export type SendableChannel = Channel & PartialTextBasedChannelFields

// const isDm = (channel: Channel): channel is DMChannel => channel.type === 'dm'
// const isText = (channel: Channel): channel is TextChannel => channel.type === 'text'
// const isVoice = (channel: Channel): channel is VoiceChannel => channel.type === 'voice'

// const isSendable = (c: Channel): c is SendableChannel =>
//   c.type === 'dm' || c.type == 'news' || c.type === 'text'

// const isPublic = (c: GuildChannel): boolean => c.permissionOverwrites.size === 0
// const isPrivate = predicate.not(isPublic)

// export const ChannelUtils = { isDm, isText, isVoice, isSendable, isPublic, isPrivate }
