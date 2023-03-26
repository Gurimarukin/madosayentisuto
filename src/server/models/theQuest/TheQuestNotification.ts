import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { createUnion } from '../../../shared/utils/createUnion'

import type { ChampionKey } from './ChampionKey'
import type { PlatformWithName } from './PlatformWithName'
import type { SummonerShort } from './SummonerShort'

type TheQuestNotification = typeof u.T

type TheQuestNotificationUserJoined = typeof u.UserJoined.T
type TheQuestNotificationUserLeft = typeof u.UserLeft.T
type TheQuestNotificationChampionLeveledUp = typeof u.ChampionLeveledUp.T

type CommonArgs = {
  readonly userId: DiscordUserId
}

type UserJoinedArgs = CommonArgs & {
  readonly summoner: SummonerShort
}

type UserLeftArgs = CommonArgs & {
  readonly summoner: PlatformWithName
}

type ChampionLeveledUpArgs = CommonArgs & {
  readonly summoner: PlatformWithName
  readonly champion: {
    readonly id: ChampionKey
    readonly level: 5 | 6 | 7
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
