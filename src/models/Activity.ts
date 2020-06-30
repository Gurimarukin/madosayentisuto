import * as t from 'io-ts'

import { ActivityTypeBot } from './ActivityTypeBot'

export function Activity(type: ActivityTypeBot, name: string): Activity {
  return { type, name }
}

export namespace Activity {
  export const codec = t.strict({
    type: ActivityTypeBot.codec,
    name: t.string
  })
}

export type Activity = t.TypeOf<typeof Activity.codec>
