import { TSnowflake } from '../models/TSnowflake'

export type Commands = Commands.CallsInit | Commands.DefaultRoleGet | Commands.DefaultRoleSet

export namespace Commands {
  // calls
  export interface CallsInit {
    readonly _tag: 'CallsInit'
    readonly channel: TSnowflake // channel where to notify calls
    readonly role: TSnowflake // role to notify
  }
  export const CallsInit = (channel: TSnowflake, role: TSnowflake): CallsInit => ({
    _tag: 'CallsInit',
    channel,
    role
  })

  // defaultRole
  export interface DefaultRoleGet {
    readonly _tag: 'DefaultRoleGet'
  }
  export const DefaultRoleGet: DefaultRoleGet = { _tag: 'DefaultRoleGet' }

  export interface DefaultRoleSet {
    readonly _tag: 'DefaultRoleSet'
    readonly role: TSnowflake
  }
  export const DefaultRoleSet = (role: TSnowflake): DefaultRoleSet => ({
    _tag: 'DefaultRoleSet',
    role
  })
}
