export type Commands = Commands.CallsSubscribe | Commands.CallsUnsubscribe

export namespace Commands {
  export type CallsSubscribe = 'CallsSubscribe'
  export const CallsSubscribe: CallsSubscribe = 'CallsSubscribe'

  export type CallsUnsubscribe = 'CallsUnsubscribe'
  export const CallsUnsubscribe: CallsUnsubscribe = 'CallsUnsubscribe'

  export interface CallsIgnore {
    user: string
  }
  export const CallsIgnore = (user: string): CallsIgnore => ({ user })
}
