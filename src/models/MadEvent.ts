import { GuildMember, Interaction, Message, PartialGuildMember, VoiceState } from 'discord.js'

export type MadEvent =
  | AppStarted
  | DbReady
  | CronJob
  | InteractionCreate
  | GuildMemberAdd
  | GuildMemberRemove
  | VoiceStateUpdate
  | MessageCreate

const isAppStarted = (e: MadEvent): e is AppStarted => e.type === 'AppStarted'
const isDbReady = (e: MadEvent): e is DbReady => e.type === 'DbReady'
const isCronJob = (e: MadEvent): e is CronJob => e.type === 'CronJob'
const isInteractionCreate = (e: MadEvent): e is InteractionCreate => e.type === 'InteractionCreate'
const isGuildMemberAdd = (e: MadEvent): e is GuildMemberAdd => e.type === 'GuildMemberAdd'
const isGuildMemberRemove = (e: MadEvent): e is GuildMemberRemove => e.type === 'GuildMemberRemove'
const isVoiceStateUpdate = (e: MadEvent): e is VoiceStateUpdate => e.type === 'VoiceStateUpdate'
const isMessageCreate = (e: MadEvent): e is MessageCreate => e.type === 'MessageCreate'

export type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

export type DbReady = { readonly type: 'DbReady' }
const DbReady: DbReady = { type: 'DbReady' }

export type CronJob = { readonly type: 'CronJob' }
const CronJob: CronJob = { type: 'CronJob' }

export type InteractionCreate = {
  readonly type: 'InteractionCreate'
  readonly interaction: Interaction
}
const InteractionCreate = (interaction: Interaction): InteractionCreate => ({
  type: 'InteractionCreate',
  interaction,
})

export type GuildMemberAdd = {
  readonly type: 'GuildMemberAdd'
  readonly member: GuildMember
}
const GuildMemberAdd = (member: GuildMember): GuildMemberAdd => ({
  type: 'GuildMemberAdd',
  member,
})

export type GuildMemberRemove = {
  readonly type: 'GuildMemberRemove'
  readonly member: GuildMember | PartialGuildMember
}
const GuildMemberRemove = (member: GuildMember | PartialGuildMember): GuildMemberRemove => ({
  type: 'GuildMemberRemove',
  member,
})

export type VoiceStateUpdate = {
  readonly type: 'VoiceStateUpdate'
  readonly oldState: VoiceState
  readonly newState: VoiceState
}
const VoiceStateUpdate = (oldState: VoiceState, newState: VoiceState): VoiceStateUpdate => ({
  type: 'VoiceStateUpdate',
  oldState,
  newState,
})

export type MessageCreate = {
  readonly type: 'MessageCreate'
  readonly message: Message
}
const MessageCreate = (message: Message): MessageCreate => ({
  type: 'MessageCreate',
  message,
})

export const MadEvent = {
  isAppStarted,
  isDbReady,
  isCronJob,
  isInteractionCreate,
  isGuildMemberAdd,
  isGuildMemberRemove,
  isVoiceStateUpdate,
  isMessageCreate,

  AppStarted,
  DbReady,
  CronJob,
  InteractionCreate,
  GuildMemberAdd,
  GuildMemberRemove,
  VoiceStateUpdate,
  MessageCreate,
}
