import type { eq } from 'fp-ts'
import { string } from 'fp-ts'

import { createEnum } from '../../../shared/utils/createEnum'

type Platform = typeof e.T

const e = createEnum('BR', 'EUN', 'EUW', 'JP', 'KR', 'LA1', 'LA2', 'NA', 'OC', 'TR', 'RU')

const defaultPlatform: Platform = 'EUW'

const Eq: eq.Eq<Platform> = string.Eq

const Platform = {
  codec: e.codec,
  values: e.values,
  defaultPlatform,
  Eq,
}

export { Platform }
