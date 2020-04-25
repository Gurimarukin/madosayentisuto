import * as t from 'io-ts'

import { TSnowflake } from '../TSnowflake'

export type CallsSubscription = t.TypeOf<typeof CallsSubscription.codec>

export namespace CallsSubscription {
  export const codec = t.strict({
    channels: t.array(TSnowflake.codec),
    ignoredUsers: t.array(TSnowflake.codec)
  })
}
