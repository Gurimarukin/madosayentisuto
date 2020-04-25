import { TSnowflake } from '../models/TSnowflake'

export type Commands = Commands.CallsSubscribe | Commands.CallsUnsubscribe | Commands.CallsIgnore

export namespace Commands {
  export interface CallsSubscribe {
    readonly _tag: 'CallsSubscribe'
  }
  export const CallsSubscribe: Commands = { _tag: 'CallsSubscribe' }

  export interface CallsUnsubscribe {
    readonly _tag: 'CallsUnsubscribe'
  }
  export const CallsUnsubscribe: Commands = { _tag: 'CallsUnsubscribe' }

  export interface CallsIgnore {
    _tag: 'CallsIgnore'
    user: TSnowflake
  }
  export const CallsIgnore = (user: TSnowflake): Commands => ({ _tag: 'CallsIgnore', user })
}
