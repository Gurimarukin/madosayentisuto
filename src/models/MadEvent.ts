import { GuildMember, PartialGuildMember, VoiceState } from 'discord.js'

export type MadEvent =
  | AppStarted
  | DbReady
  | CronJob
  | GuildMemberAdd
  | GuildMemberRemove
  | VoiceStateUpdate

const isAppStarted = (e: MadEvent): e is AppStarted => e.type === 'AppStarted'
const isDbReady = (e: MadEvent): e is DbReady => e.type === 'DbReady'
const isCronJob = (e: MadEvent): e is CronJob => e.type === 'CronJob'
const isGuildMemberAdd = (e: MadEvent): e is GuildMemberAdd => e.type === 'GuildMemberAdd'
const isGuildMemberRemove = (e: MadEvent): e is GuildMemberRemove => e.type === 'GuildMemberRemove'
const isVoiceStateUpdate = (e: MadEvent): e is VoiceStateUpdate => e.type === 'VoiceStateUpdate'

export type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

export type DbReady = { readonly type: 'DbReady' }
const DbReady: DbReady = { type: 'DbReady' }

export type CronJob = { readonly type: 'CronJob' }
const CronJob: CronJob = { type: 'CronJob' }

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

export const MadEvent = {
  isAppStarted,
  isDbReady,
  isCronJob,
  isGuildMemberAdd,
  isGuildMemberRemove,
  isVoiceStateUpdate,

  AppStarted,
  DbReady,
  CronJob,
  GuildMemberAdd,
  GuildMemberRemove,
  VoiceStateUpdate,
}
