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

export type MadEventAppStarted = typeof MadEvent.AppStarted.T
export type MadEventDbReady = typeof MadEvent.DbReady.T
export type MadEventCronJob = typeof MadEvent.CronJob.T
export type MadEventInteractionCreate = typeof MadEvent.InteractionCreate.T
export type MadEventGuildMemberAdd = typeof MadEvent.GuildMemberAdd.T
export type MadEventGuildMemberRemove = typeof MadEvent.GuildMemberRemove.T
export type MadEventVoiceStateUpdate = typeof MadEvent.VoiceStateUpdate.T
export type MadEventPublicCallStarted = typeof MadEvent.PublicCallStarted.T
export type MadEventPublicCallEnded = typeof MadEvent.PublicCallEnded.T
export type MadEventMessageCreate = typeof MadEvent.MessageCreate.T
