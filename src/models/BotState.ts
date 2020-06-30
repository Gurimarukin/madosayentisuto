import * as t from 'io-ts'
import { optionFromNullable } from 'io-ts-types/lib/optionFromNullable'
import { Lens as MonocleLens } from 'monocle-ts'

import { Activity } from './Activity'
import { Maybe } from '../utils/fp'

export type BotState = t.TypeOf<typeof BotState.codec>

export function BotState(activity: Maybe<Activity>): BotState {
  return { activity }
}

export namespace BotState {
  export const codec = t.strict({
    activity: optionFromNullable(Activity.codec)
  })

  export const empty: BotState = BotState(Maybe.none)

  export namespace Lens {
    export const activity = MonocleLens.fromPath<BotState>()(['activity'])
  }
}
