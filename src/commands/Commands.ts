import { TSnowflake } from '../models/TSnowflake'
import { ActivityConfig } from '../config/Config'
import { Maybe } from '../utils/fp'

export type Commands =
  | Commands.CallsInit
  | Commands.DefaultRoleGet
  | Commands.DefaultRoleSet
  | Commands.Say
  | Commands.ActivityGet
  | Commands.ActivityUnset
  | Commands.ActivitySet

export namespace Commands {
  // calls
  export interface CallsInit {
    readonly _tag: 'CallsInit'
    readonly channel: TSnowflake // channel where to notify calls
    readonly role: TSnowflake // role to notify
  }
  export function CallsInit(channel: TSnowflake, role: TSnowflake): CallsInit {
    return { _tag: 'CallsInit', channel, role }
  }

  // defaultRole
  export interface DefaultRoleGet {
    readonly _tag: 'DefaultRoleGet'
  }
  export const DefaultRoleGet: DefaultRoleGet = { _tag: 'DefaultRoleGet' }

  export interface DefaultRoleSet {
    readonly _tag: 'DefaultRoleSet'
    readonly role: TSnowflake
  }
  export function DefaultRoleSet(role: TSnowflake): DefaultRoleSet {
    return { _tag: 'DefaultRoleSet', role }
  }

  // says
  export interface Say {
    readonly _tag: 'Say'
    readonly attachments: string[]
    readonly message: string
  }
  export function Say(attachments: string[], message: string): Say {
    return { _tag: 'Say', attachments, message }
  }

  // activity
  export interface ActivityGet {
    readonly _tag: 'ActivityGet'
  }
  export const ActivityGet: ActivityGet = { _tag: 'ActivityGet' }

  export interface ActivityUnset {
    readonly _tag: 'ActivityUnset'
  }
  export const ActivityUnset: ActivityUnset = { _tag: 'ActivityUnset' }

  export interface ActivitySet {
    readonly _tag: 'ActivitySet'
    readonly config: Maybe<ActivityConfig>
  }
  export function ActivitySet(config: Maybe<ActivityConfig>): ActivitySet {
    return { _tag: 'ActivitySet', config }
  }
}
