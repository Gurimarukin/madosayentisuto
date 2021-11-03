import { GuildMember, PartialGuildMember, VoiceState } from 'discord.js'

export type MadEvent =
  | AppStarted
  | DbReady
  | CronJob
  | GuildMemberAdd
  | GuildMemberRemove
  | VoiceStateUpdate

type AppStarted = { readonly type: 'AppStarted' }
const AppStarted: AppStarted = { type: 'AppStarted' }

type DbReady = { readonly type: 'DbReady' }
const DbReady: DbReady = { type: 'DbReady' }

type CronJob = { readonly type: 'CronJob' }
const CronJob: CronJob = { type: 'CronJob' }

type GuildMemberAdd = {
  readonly type: 'GuildMemberAdd'
  readonly member: GuildMember
}
const GuildMemberAdd = (member: GuildMember): GuildMemberAdd => ({
  type: 'GuildMemberAdd',
  member,
})

type GuildMemberRemove = {
  readonly type: 'GuildMemberRemove'
  readonly member: GuildMember | PartialGuildMember
}
const GuildMemberRemove = (member: GuildMember | PartialGuildMember): GuildMemberRemove => ({
  type: 'GuildMemberRemove',
  member,
})

type VoiceStateUpdate = {
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
  AppStarted,
  DbReady,
  CronJob,
  GuildMemberAdd,
  GuildMemberRemove,
  VoiceStateUpdate,
}
