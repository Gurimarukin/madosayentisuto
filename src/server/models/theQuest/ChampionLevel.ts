import { createEnum } from '../../../shared/utils/createEnum'
import type { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'

type ChampionLevel = typeof e.T

const e = createEnum(5, 6, 7, 8, 9, 10)

const values: List<number> = e.values

function isChampionLevel(n: number): n is ChampionLevel {
  return values.includes(n)
}

function fromNumber(n: number): Maybe<ChampionLevel> {
  if (isChampionLevel(n)) return Maybe.some(n)

  if (10 < n) return Maybe.some(10)

  return Maybe.none
}

const ChampionLevel = { values: e.values, fromNumber }

export { ChampionLevel as ChampionLevel_ }
