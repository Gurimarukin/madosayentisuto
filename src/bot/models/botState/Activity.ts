import { ActivityTypeBot } from 'bot/models/botState/ActivityTypeBot'
import * as C from 'io-ts/Codec'

const of = (type: ActivityTypeBot, name: string): Activity => ({ type, name })

const codec = C.struct({
  type: ActivityTypeBot.codec,
  name: C.string,
})

export type Activity = C.TypeOf<typeof codec>

export const Activity = { of, codec }
