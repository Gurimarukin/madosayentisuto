import type { Channel, PartialDMChannel } from 'discord.js'
import { GuildChannel, StageChannel, TextChannel, ThreadChannel, VoiceChannel } from 'discord.js'
import { predicate, refinement } from 'fp-ts'
import { pipe } from 'fp-ts/function'

type Chan = Channel | PartialDMChannel

const isGuildChannel = (channel: Chan): channel is GuildChannel => channel instanceof GuildChannel
const isStageChannel = (channel: Chan): channel is StageChannel => channel instanceof StageChannel
const isTextChannel = (channel: Chan): channel is TextChannel => channel instanceof TextChannel
const isThreadChannel = (channel: Chan): channel is ThreadChannel =>
  channel instanceof ThreadChannel
const isVoiceChannel = (channel: Chan): channel is VoiceChannel => channel instanceof VoiceChannel

const isNamedChannel = pipe(
  isGuildChannel,
  refinement.or(isThreadChannel),
  refinement.or(isStageChannel),
  refinement.or(isVoiceChannel),
)

const isPublic = (channel: GuildChannel): boolean =>
  // channel.permissionsFor('everyone')
  channel.permissionOverwrites.valueOf().filter(p => {
    const res = !(p.deny.bitfield === BigInt(0) && p.allow.bitfield === BigInt(0))
    if (channel.name === 'Mon poignard') {
      console.log('p.deny.bitfield =', p.deny.bitfield)
      console.log('p.allow.bitfield =', p.allow.bitfield)
      console.log('BigInt(0) =', BigInt(0))
      console.log('res =', res)
    }
    return res
  }).size === 0

const isPrivate = predicate.not(isPublic)

export const ChannelUtils = {
  isGuildChannel,
  isStageChannel,
  isTextChannel,
  isThreadChannel,
  isVoiceChannel,

  isNamedChannel,
  isPublic,
  isPrivate,
}
