import { TSnowflake } from '../../models/TSnowflake'

export type ReferentialAction = ReferentialAction.CallsSubscribe

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
}
