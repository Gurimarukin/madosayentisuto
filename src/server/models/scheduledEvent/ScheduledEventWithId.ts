import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { TObjectId } from '../mongo/TObjectId'
import { ScheduledEvent } from './ScheduledEvent'

const decoder = pipe(
  D.struct({
    _id: TObjectId.decoder,
  }),
  D.intersect(ScheduledEvent.codec),
)

export type ScheduledEventWithId = D.TypeOf<typeof decoder>
export const ScheduledEventWithId = { decoder }
