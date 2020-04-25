import * as t from 'io-ts'

import { CallsSubscription } from './CallsSubscription'

export type Referential = t.TypeOf<typeof Referential.codec>

export namespace Referential {
  export const codec = t.strict({
    callsSubscription: t.record(t.string, CallsSubscription.codec)
  })

  export const empty: Referential = {
    callsSubscription: {}
  }
}
