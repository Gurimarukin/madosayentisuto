import { number, ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { NonEmptyArray } from '../../../shared/utils/fp'

import { NumberRecord } from '../../utils/ioTsUtils'
import { ChampionKey } from './ChampionKey'
import { Platform } from './Platform'
import { Puuid } from './Puuid'
import { RiotId } from './RiotId'

type TheQuestProgressionApi = D.TypeOf<typeof decoder>

const decoder = D.struct({
  userId: DiscordUserId.codec,
  summoner: D.struct({
    puuid: Puuid.codec,
    platform: Platform.codec,
    riotId: RiotId.fromStringCodec,
    profileIconId: D.number,
  }),
  percents: D.number,
  totalMasteryLevel: D.number,
  totalMasteryPoints: D.number,
  // champion level as keys
  champions: NumberRecord.decoder(NonEmptyArray.decoder(ChampionKey.codec)),
})

const byPercentsOrd: ord.Ord<TheQuestProgressionApi> = pipe(
  number.Ord,
  ord.contramap((p: TheQuestProgressionApi) => p.percents),
)

const TheQuestProgressionApi = { decoder, byPercentsOrd }

export { TheQuestProgressionApi }
