import { TSnowflake } from '../../models/TSnowflake'

export type ReferentialAction = ReferentialAction.CallsSubscribe | ReferentialAction.CallsIgnore

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
