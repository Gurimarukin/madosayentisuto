import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { List } from '../../../shared/utils/fp'

import { ChampionKey } from './ChampionKey'
import { Platform } from './Platform'
import { RiotId } from './RiotId'

type TheQuestProgressionDb = C.TypeOf<typeof codec>

const codec = C.struct({
  userId: DiscordUserId.codec,
  summoner: C.struct({
    platform: Platform.codec,
    riotId: RiotId.fromStringCodec,
  }),
  champions: C.struct({
    mastery7: List.codec(ChampionKey.codec),
    mastery6: List.codec(ChampionKey.codec),
    mastery5: List.codec(ChampionKey.codec),
  }),
})

const TheQuestProgressionDb = { codec }

type TheQuestProgressionDbOutput = C.OutputOf<typeof codec>

export { TheQuestProgressionDb, type TheQuestProgressionDbOutput }
