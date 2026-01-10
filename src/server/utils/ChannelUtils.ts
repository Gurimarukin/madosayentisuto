import type {
  APIPartialChannel,
  CategoryChannel,
  Channel,
  DMChannel,
  NewsChannel,
  PartialGroupDMChannel,
  PrivateThreadChannel,
  PublicThreadChannel,
  StageChannel,
  TextChannel,
  VoiceChannel,
} from 'discord.js'
import { ChannelType } from 'discord.js'
import { eq, refinement } from 'fp-ts'
import type { Refinement } from 'fp-ts/Refinement'
import { pipe } from 'fp-ts/function'

import { ChannelId } from '../../shared/models/ChannelId'
import type { ChannelView } from '../../shared/models/ChannelView'
import { Maybe } from '../../shared/utils/fp'

const isGuildText = (c: Channel): c is TextChannel => {
  // A text channel within a guild
  if (c.type !== ChannelType.GuildText) return false
  const {}: TextChannel = c
  return true
}

const isDM = (c: Channel): c is DMChannel => {
  // A direct message between users
  if (c.type !== ChannelType.DM) return false
  const {}: DMChannel = c
  return true
}

const isGuildVoice = (c: Channel): c is VoiceChannel => {
  // A voice channel within a guild
  if (c.type !== ChannelType.GuildVoice) return false
  const {}: VoiceChannel = c
  return true
}

const isGroupDM = (c: Channel): c is PartialGroupDMChannel => {
  // A direct message between multiple users
  if (c.type !== ChannelType.GroupDM) return false
  const {}: PartialGroupDMChannel = c
  return true
}

const isGuildCategory = (c: Channel): c is CategoryChannel => {
  // An organizational category that contains up to 50 channels
  // See https://support.discord.com/hc/en-us/articles/115001580171-Channel-Categories-101
  if (c.type !== ChannelType.GuildCategory) return false
  const {}: CategoryChannel = c
  return true
}

const isGuildNews = (c: Channel): c is NewsChannel => {
  // A channel that users can follow and crosspost into their own guild
  // See https://support.discord.com/hc/en-us/articles/360032008192
  if (c.type !== ChannelType.GuildAnnouncement) return false
  const {}: NewsChannel = c
  return true
}

const isGuildNewsThread = (c: Channel): c is PublicThreadChannel => {
  // A thread channel (public) within a Guild News channel
  if (c.type !== ChannelType.AnnouncementThread) return false
  const {}: PublicThreadChannel = c
  return true
}

const isGuildPublicThread = (c: Channel): c is PublicThreadChannel => {
  // A public thread channel within a Guild Text channel
  if (c.type !== ChannelType.PublicThread) return false
  const {}: PublicThreadChannel = c
  return true
}

const isGuildPrivateThread = (c: Channel): c is PrivateThreadChannel => {
  // A private thread channel within a Guild Text channel
  if (c.type !== ChannelType.PrivateThread) return false
  const {}: PrivateThreadChannel = c
  return true
}

const isGuildStageVoice = (c: Channel): c is StageChannel => {
  // A voice channel for hosting events with an audience
  // See https://support.discord.com/hc/en-us/articles/1500005513722
  if (c.type !== ChannelType.GuildStageVoice) return false
  const {}: StageChannel = c
  return true
}

// unions

export type NamedChannel = RefinementResult<typeof isNamed>

const isNamed = pipe(
  isGuildText,
  // refinement.or(isDM),
  refinement.or(isGuildVoice),
  // refinement.or(isGroupDM),
  refinement.or(isGuildCategory),
  refinement.or(isGuildNews),
  refinement.or(isGuildNewsThread),
  refinement.or(isGuildPublicThread),
  refinement.or(isGuildPrivateThread),
  refinement.or(isGuildStageVoice),
)

export type GuildSendableChannel = RefinementResult<typeof isGuildSendable>

const isGuildSendable = pipe(
  isGuildText,
  // refinement.or(isDM),
  refinement.or(isGuildVoice),
  // refinement.or(isGroupDM),
  // refinement.or(isGuildCategory),
  refinement.or(isGuildNews),
  refinement.or(isGuildNewsThread),
  refinement.or(isGuildPublicThread),
  refinement.or(isGuildPrivateThread),
  // refinement.or(isGuildStageVoice),
)

export type GuildPositionableChannel = RefinementResult<typeof isGuildPositionable>

const isGuildPositionable = pipe(
  isGuildText,
  // refinement.or(isDM),
  refinement.or(isGuildVoice),
  // refinement.or(isGroupDM),
  // refinement.or(isGuildCategory),
  refinement.or(isGuildNews),
  // refinement.or(isGuildNewsThread),
  // refinement.or(isGuildPublicThread),
  // refinement.or(isGuildPrivateThread),
  // refinement.or(isGuildStageVoice),
)

export type GuildAudioChannel = RefinementResult<typeof isGuildAudio>

const isGuildAudio = pipe(isGuildVoice, refinement.or(isGuildStageVoice))

// type PermissionableChannel = RefinementResult<typeof isPermissionable>

// const isPermissionable = pipe(
//   isGuildText,
//   // refinement.or(isDM),
//   refinement.or(isGuildVoice),
//   // refinement.or(isGroupDM),
//   refinement.or(isGuildCategory),
//   refinement.or(isGuildNews),
//   // refinement.or(isGuildNewsThread),
//   // refinement.or(isGuildPublicThread),
//   // refinement.or(isGuildPrivateThread),
//   refinement.or(isGuildStageVoice),
// )

const isThread = pipe(
  isGuildNewsThread,
  refinement.or(isGuildPublicThread),
  refinement.or(isGuildPrivateThread),
)

// utils

const toView = (c: Channel): ChannelView => ({
  id: ChannelId.fromChannel(c),
  name: isNamed(c) ? Maybe.some(c.name) : Maybe.none,
})

const byId: eq.Eq<APIPartialChannel> = pipe(ChannelId.Eq, eq.contramap(ChannelId.fromChannel))

const getById = <A extends APIPartialChannel>(): eq.Eq<A> => byId

// export

export const ChannelUtils = {
  isGuildText,
  isDM,
  isGuildVoice,
  isGroupDM,
  isGuildCategory,
  isGuildNews,
  isGuildNewsThread,
  isGuildPublicThread,
  isGuildPrivateThread,
  isGuildStageVoice,

  isNamed,
  isGuildSendable,
  isGuildPositionable,
  isGuildAudio,
  isThread,

  toView,
  Eq: { byId, getById },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RefinementResult<A> = A extends Refinement<any, infer C> ? C : never
