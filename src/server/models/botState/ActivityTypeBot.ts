import { ActivityType } from 'discord.js'

import { createEnum } from '../../../shared/utils/createEnum'
import type { Dict } from '../../../shared/utils/fp'

const enum_ = createEnum('PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING')
const { values, decoder, encoder, codec } = enum_

export type ActivityTypeBot = typeof enum_.T

const activityType: Dict<ActivityTypeBot, Exclude<ActivityType, ActivityType.Custom>> = {
  PLAYING: ActivityType.Playing,
  STREAMING: ActivityType.Streaming,
  LISTENING: ActivityType.Listening,
  WATCHING: ActivityType.Watching,
  COMPETING: ActivityType.Competing,
}

export const ActivityTypeBot = { values, decoder, encoder, codec, activityType }
