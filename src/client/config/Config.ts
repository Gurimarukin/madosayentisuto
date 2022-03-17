import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { parseConfig } from '../../shared/utils/config/parseConfig'
import type { Dict, Try } from '../../shared/utils/fp'

const { seqS } = ValidatedNea

export type Config = {
  readonly apiHost: string
}

const parse = (rawConfig: Dict<string, string | undefined>): Try<Config> =>
  parseConfig(rawConfig)(r =>
    seqS<Config>({
      apiHost: r(D.string)('API_HOST'),
    }),
  )

export const Config = { parse }
