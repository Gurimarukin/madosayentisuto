import type { PlatformWithRiotId } from './PlatformWithRiotId'

type SummonerShort = PlatformWithRiotId & {
  profileIcondId: number
}

export { SummonerShort }
