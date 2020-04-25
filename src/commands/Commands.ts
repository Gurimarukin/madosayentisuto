import { TSnowflake } from '../models/TSnowflake'

export type Commands = Commands.CallsSubscribe | Commands.CallsUnsubscribe | Commands.CallsIgnore

export namespace Commands {
  export type CallsSubscribe = 'CallsSubscribe'
  export const CallsSubscribe: CallsSubscribe = 'CallsSubscribe'

  export type CallsUnsubscribe = 'CallsUnsubscribe'
  export const CallsUnsubscribe: CallsUnsubscribe = 'CallsUnsubscribe'

  export interface CallsIgnore {
    user: TSnowflake
  }
  export const CallsIgnore = (user: TSnowflake): CallsIgnore => ({ user })
}
