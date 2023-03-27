import * as D from 'io-ts/Decoder'

import { List } from '../../../shared/utils/fp'

import { ChampionId } from './ChampionId'
import { ChampionKey } from './ChampionKey'
import { DDragonVersion } from './DDragonVersion'

type StaticData = D.TypeOf<typeof decoder>

const decoder = D.struct({
  version: DDragonVersion.codec,
  champions: List.decoder(
    D.struct({
      id: ChampionId.codec,
      key: ChampionKey.codec,
      name: D.string,
    }),
  ),
})

const StaticData = { decoder }

export { StaticData }
