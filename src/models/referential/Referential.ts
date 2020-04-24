import * as t from 'io-ts'

import { SpamSubscription } from './SpamSubscription'

export type Referential = t.TypeOf<typeof Referential.codec>

export namespace Referential {
  export const codec = t.strict({
    spamSubscriptions: t.record(t.string, SpamSubscription.codec)
  })
}
