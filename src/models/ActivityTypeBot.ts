import * as t from 'io-ts'

export namespace ActivityTypeBot {
  export const codec = t.union([
    t.literal('PLAYING'),
    t.literal('STREAMING'),
    t.literal('LISTENING'),
    t.literal('WATCHING')
  ])
}

export type ActivityTypeBot = t.TypeOf<typeof ActivityTypeBot.codec>
