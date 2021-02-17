import * as C from 'io-ts/Codec'

import { ActivityTypeBot } from './ActivityTypeBot'

export function Activity(type: ActivityTypeBot, name: string): Activity {
  return { type, name }
}

export namespace Activity {
  export const codec = C.type({
    type: ActivityTypeBot.codec,
    name: C.string,
  })
}

export type Activity = C.TypeOf<typeof Activity.codec>
