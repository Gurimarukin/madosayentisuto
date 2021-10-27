import { GuildBan, GuildMember, PartialGuildMember } from 'discord.js'

export type MadEvent =
  | AppStarted
  | DbReady
  | CronJob
  | GuildMemberAdd
  | GuildMemberRemove
  | GuildBanAdd

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

type GuildBanAdd = {
  readonly type: 'GuildBanAdd'
  readonly ban: GuildBan
}
const GuildBanAdd = (ban: GuildBan): GuildBanAdd => ({
  type: 'GuildBanAdd',
  ban,
})

export const MadEvent = {
  AppStarted,
  DbReady,
  CronJob,
  GuildMemberAdd,
  GuildMemberRemove,
  GuildBanAdd,
}
