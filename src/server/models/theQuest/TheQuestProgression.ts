import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { List } from '../../../shared/utils/fp'

import { ChampionKey } from './ChampionKey'
import { Summoner } from './Summoner'

type TheQuestProgression = D.TypeOf<typeof decoder>

const decoder = D.struct({
  userId: DiscordUserId.codec,
  summoner: Summoner.codec,
  percents: D.number,
  totalMasteryLevel: D.number,
  champions: D.struct({
    mastery7: List.decoder(ChampionKey.codec),
    mastery6: List.decoder(ChampionKey.codec),
    mastery5: List.decoder(ChampionKey.codec),
  }),
})

const TheQuestProgression = { decoder }

export { TheQuestProgression }
