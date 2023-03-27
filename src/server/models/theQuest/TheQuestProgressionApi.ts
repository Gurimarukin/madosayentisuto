import { number, ord } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { List } from '../../../shared/utils/fp'

import { ChampionKey } from './ChampionKey'
import { Platform } from './Platform'
import { SummonerId } from './SummonerId'

type TheQuestProgressionApi = D.TypeOf<typeof decoder>

const decoder = D.struct({
  userId: DiscordUserId.codec,
  summoner: D.struct({
    id: SummonerId.codec,
    platform: Platform.codec,
    name: D.string,
    profileIconId: D.number,
  }),
  percents: D.number,
  totalMasteryLevel: D.number,
  champions: D.struct({
    mastery7: List.decoder(ChampionKey.codec),
    mastery6: List.decoder(ChampionKey.codec),
    mastery5: List.decoder(ChampionKey.codec),
  }),
})

const byPercentsOrd: ord.Ord<TheQuestProgressionApi> = pipe(
  number.Ord,
  ord.contramap(p => p.percents),
)

const TheQuestProgressionApi = { decoder, byPercentsOrd }

export { TheQuestProgressionApi }
