import type {
  GuildMember,
  Interaction,
  Message,
  PartialGuildMember,
  StageChannel,
  VoiceChannel,
  VoiceState,
} from 'discord.js'

import { createUnion } from '../../utils/createUnion'

export type MadEvent = typeof MadEvent.T

export const MadEvent = createUnion({
  AppStarted: () => ({}),

  DbReady: () => ({}),

  CronJob: () => ({}),

  InteractionCreate: (interaction: Interaction) => ({ interaction }),

  GuildMemberAdd: (member: GuildMember) => ({ member }),

  GuildMemberRemove: (member: GuildMember | PartialGuildMember) => ({ member }),

  VoiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => ({ oldState, newState }),

  PublicCallStarted: (member: GuildMember, channel: VoiceChannel | StageChannel) => ({
    member,
    channel,
  }),

  PublicCallEnded: (member: GuildMember, channel: VoiceChannel | StageChannel) => ({
    member,
    channel,
  }),

  MessageCreate: (message: Message) => ({ message }),
})

export type AppStarted = typeof MadEvent.AppStarted.T
export type DbReady = typeof MadEvent.DbReady.T
export type CronJob = typeof MadEvent.CronJob.T
export type InteractionCreate = typeof MadEvent.InteractionCreate.T
export type GuildMemberAdd = typeof MadEvent.GuildMemberAdd.T
export type GuildMemberRemove = typeof MadEvent.GuildMemberRemove.T
export type VoiceStateUpdate = typeof MadEvent.VoiceStateUpdate.T
export type PublicCallStarted = typeof MadEvent.PublicCallStarted.T
export type PublicCallEnded = typeof MadEvent.PublicCallEnded.T
export type MessageCreate = typeof MadEvent.MessageCreate.T
