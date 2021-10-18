import { Activity } from '../models/Activity'
import { TSnowflake } from '../models/TSnowflake'

export type Commands =
  | Commands.CallsInit
  | Commands.DefaultRoleGet
  | Commands.DefaultRoleSet
  | Commands.Say
  | Commands.ActivityGet
  | Commands.ActivityUnset
  | Commands.ActivitySet
  | Commands.ActivityRefresh
  | Commands.Kouizine
  | Commands.Image

export namespace Commands {
  // calls
  export type CallsInit = {
    readonly _tag: 'CallsInit'
    readonly channel: TSnowflake // channel where to notify calls
    readonly role: TSnowflake // role to notify
  };
  export function CallsInit(channel: TSnowflake, role: TSnowflake): CallsInit {
    return { _tag: 'CallsInit', channel, role }
  }

  // defaultRole
  export type DefaultRoleGet = {
    readonly _tag: 'DefaultRoleGet'
  };
  export const DefaultRoleGet: DefaultRoleGet = { _tag: 'DefaultRoleGet' }

  export type DefaultRoleSet = {
    readonly _tag: 'DefaultRoleSet'
    readonly role: TSnowflake
  };
  export function DefaultRoleSet(role: TSnowflake): DefaultRoleSet {
    return { _tag: 'DefaultRoleSet', role }
  }

  // says
  export type Say = {
    readonly _tag: 'Say'
    readonly attachments: ReadonlyArray<string>
    readonly message: string
  };
  export function Say(attachments: ReadonlyArray<string>, message: string): Say {
    return { _tag: 'Say', attachments, message }
  }

  // activity
  export type ActivityGet = {
    readonly _tag: 'ActivityGet'
  };
  export const ActivityGet: ActivityGet = { _tag: 'ActivityGet' }

  export type ActivityUnset = {
    readonly _tag: 'ActivityUnset'
  };
  export const ActivityUnset: ActivityUnset = { _tag: 'ActivityUnset' }

  export type ActivitySet = {
    readonly _tag: 'ActivitySet'
    readonly activity: Activity
  };
  export function ActivitySet(activity: Activity): ActivitySet {
    return { _tag: 'ActivitySet', activity }
  }

  export type ActivityRefresh = {
    readonly _tag: 'ActivityRefresh'
  };
  export const ActivityRefresh: ActivityRefresh = { _tag: 'ActivityRefresh' }

  // kouizine
  export type Kouizine = {
    readonly _tag: 'Kouizine'
  };
  export const Kouizine: Kouizine = { _tag: 'Kouizine' }

  // images
  export type Image = {
    readonly _tag: 'Image'
    readonly value: string
  };
  export function Image(value: string): Image {
    return { _tag: 'Image', value }
  }
}
