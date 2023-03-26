import type { PlatformWithName } from './PlatformWithName'

type SummonerShort = PlatformWithName & {
  readonly profileIcondId: number
}

export { SummonerShort }
