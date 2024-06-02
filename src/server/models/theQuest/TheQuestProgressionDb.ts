import * as C from 'io-ts/Codec'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { NonEmptyArray } from '../../../shared/utils/fp'

import { NumberRecord } from '../../utils/ioTsUtils'
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
  // champion level as keys
  champions: NumberRecord.codec(NonEmptyArray.codec(ChampionKey.codec)),
})

const TheQuestProgressionDb = { codec }

type TheQuestProgressionDbOutput = C.OutputOf<typeof codec>

export { TheQuestProgressionDb, type TheQuestProgressionDbOutput }
