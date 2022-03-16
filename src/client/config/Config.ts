import * as D from 'io-ts/Decoder'

import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { parseConfig } from '../../shared/utils/config/parseConfig'
import type { Dict, Try } from '../../shared/utils/fp'

export type Config = {
  readonly apiHost: string
}

const parse = (rawConfig: Dict<string, string | undefined>): Try<Config> =>
  parseConfig(rawConfig)(r =>
    ValidatedNea.sequenceS({
      apiHost: r(D.string)('API_HOST'),
    }),
  )

export const Config = { parse }
