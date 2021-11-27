import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../../../shared/utils/fp'

import { Activity } from './Activity'

const codec = C.struct({
  activity: Maybe.codec(Activity.codec),
})

const of = (activity: Maybe<Activity>): BotState => ({ activity })

const empty: BotState = of(Maybe.none)

export type BotState = C.TypeOf<typeof codec>
export type BotStateOutput = C.OutputOf<typeof codec>

export const BotState = {
  codec,
  of,
  empty,
  activity: MonocleLens.fromPath<BotState>()(['activity']),
}
