import { TSnowflake } from '../../models/TSnowflake'

export type ReferentialAction =
  | ReferentialAction.CallsSubscribe
  | ReferentialAction.CallsUnsubscribe
  | ReferentialAction.CallsIgnore

export namespace ReferentialAction {
  export interface CallsSubscribe {
    readonly type: 'CallsSubscribe'
    readonly guild: TSnowflake
    readonly channel: TSnowflake
  }
  export const CallsSubscribe = (guild: TSnowflake, channel: TSnowflake): ReferentialAction => ({
    type: 'CallsSubscribe',
    guild,
    channel
  })

  export interface CallsUnsubscribe {
    readonly type: 'CallsUnsubscribe'
    readonly guild: TSnowflake
    readonly channel: TSnowflake
  }
  export const CallsUnsubscribe = (guild: TSnowflake, channel: TSnowflake): ReferentialAction => ({
    type: 'CallsUnsubscribe',
    guild,
    channel
  })

  export interface CallsIgnore {
    readonly type: 'CallsIgnore'
    readonly guild: TSnowflake
    readonly user: TSnowflake
  }
  export const CallsIgnore = (guild: TSnowflake, user: TSnowflake): ReferentialAction => ({
    type: 'CallsIgnore',
    guild,
    user
  })
}
