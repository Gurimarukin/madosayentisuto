import type {
  GuildMember,
  Interaction,
  Message,
  PartialGuildMember,
  PartialMessage,
  VoiceState,
} from 'discord.js'

import type { DayJs } from '../../../shared/models/DayJs'
import { createUnion } from '../../../shared/utils/createUnion'
import type { List } from '../../../shared/utils/fp'

import type { GuildAudioChannel } from '../../utils/ChannelUtils'

export type MadEvent = typeof MadEvent.T

export const MadEvent = createUnion({
  AppStarted: () => ({}),

  CronJob: (date: DayJs) => ({ date }),

  InteractionCreate: (interaction: Interaction) => ({ interaction }),

  GuildMemberAdd: (member: GuildMember) => ({ member }),

  GuildMemberRemove: (member: GuildMember | PartialGuildMember) => ({ member }),

  VoiceStateUpdate: (oldState: VoiceState, newState: VoiceState) => ({ oldState, newState }),

  PublicCallStarted: (member: GuildMember, channel: GuildAudioChannel) => ({
    member,
    channel,
  }),

  PublicCallEnded: (member: GuildMember, channel: GuildAudioChannel) => ({
    member,
    channel,
  }),

  MessageCreate: (message: Message) => ({ message }),

  MessageDelete: (messages: List<Message | PartialMessage>) => ({ messages }),
})

export type MadEventAppStarted = typeof MadEvent.AppStarted.T
export type MadEventCronJob = typeof MadEvent.CronJob.T
export type MadEventInteractionCreate = typeof MadEvent.InteractionCreate.T
export type MadEventGuildMemberAdd = typeof MadEvent.GuildMemberAdd.T
export type MadEventGuildMemberRemove = typeof MadEvent.GuildMemberRemove.T
export type MadEventVoiceStateUpdate = typeof MadEvent.VoiceStateUpdate.T
export type MadEventPublicCallStarted = typeof MadEvent.PublicCallStarted.T
export type MadEventPublicCallEnded = typeof MadEvent.PublicCallEnded.T
export type MadEventMessageCreate = typeof MadEvent.MessageCreate.T
export type MadEventMessageDelete = typeof MadEvent.MessageDelete.T
