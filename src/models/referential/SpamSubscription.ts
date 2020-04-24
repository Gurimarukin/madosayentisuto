import * as t from 'io-ts'

import { TSnowflake } from '../TSnowflake'

export type SpamSubscription = t.TypeOf<typeof SpamSubscription.codec>

export namespace SpamSubscription {
  export const codec = t.strict({
    channels: t.array(TSnowflake.codec),
    ignoredUsers: t.array(TSnowflake.codec)
  })
}
