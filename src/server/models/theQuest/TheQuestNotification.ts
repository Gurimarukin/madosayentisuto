import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { createUnion } from '../../../shared/utils/createUnion'

import type { ChampionKey } from './ChampionKey'
import type { ChampionLevel } from './ChampionLevel'
import type { PlatformWithName } from './PlatformWithName'
import type { SummonerShort } from './SummonerShort'

type TheQuestNotification = typeof u.T

type TheQuestNotificationUserJoined = typeof u.UserJoined.T
type TheQuestNotificationUserLeft = typeof u.UserLeft.T
type TheQuestNotificationChampionLeveledUp = typeof u.ChampionLeveledUp.T

type CommonArgs = {
  userId: DiscordUserId
}

type UserJoinedArgs = CommonArgs & {
  summoner: SummonerShort
}

type UserLeftArgs = CommonArgs & {
  summoner: PlatformWithName
}

type ChampionLeveledUpArgs = CommonArgs & {
  summoner: PlatformWithName
  champion: {
    id: ChampionKey
    level: ChampionLevel
  }
}

const u = createUnion({
  UserJoined: (args: UserJoinedArgs) => args,
  UserLeft: (args: UserLeftArgs) => args,
  ChampionLeveledUp: (args: ChampionLeveledUpArgs) => args,
})

const TheQuestNotification = { ...u }

export {
  TheQuestNotification,
  TheQuestNotificationUserJoined,
  TheQuestNotificationUserLeft,
  TheQuestNotificationChampionLeveledUp,
}
