import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { parseConfig } from '../../shared/utils/config/parseConfig'
import type { Dict, Try } from '../../shared/utils/fp'
import { URLFromString } from '../../shared/utils/ioTsUtils'

const seqS = ValidatedNea.getSeqS<string>()

export type Config = {
  readonly apiHost: URL
}

const parse = (rawConfig: Dict<string, string | undefined>): Try<Config> =>
  parseConfig(rawConfig)(r =>
    seqS<Config>({
      apiHost: r(URLFromString.decoder)('API_HOST'),
    }),
  )

export const Config = { parse }
