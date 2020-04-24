import { TSnowflake } from '../../models/TSnowflake'

export type ReferentialAction = ReferentialAction.SubscribeToSpam

export namespace ReferentialAction {
  export interface SubscribeToSpam {
    readonly type: 'SubscribeToSpam'
    readonly guild: TSnowflake
    readonly channel: TSnowflake
  }
  export const SubscribeToSpam = (guild: TSnowflake, channel: TSnowflake): ReferentialAction => ({
    type: 'SubscribeToSpam',
    guild,
    channel
  })
}
