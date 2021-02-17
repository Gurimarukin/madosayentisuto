import * as C from 'io-ts/Codec'
import { Lens as MonocleLens } from 'monocle-ts'

import { Maybe } from '../utils/fp'
import { Activity } from './Activity'

export type BotState = C.TypeOf<typeof BotState.codec>

export function BotState(activity: Maybe<Activity>): BotState {
  return { activity }
}

export namespace BotState {
  export const codec = C.type({
    activity: Maybe.codec(Activity.codec),
  })

  export type Output = C.OutputOf<typeof codec>

  export const empty: BotState = BotState(Maybe.none)

  export namespace Lens {
    export const activity = MonocleLens.fromPath<BotState>()(['activity'])
  }
}
