import { PartialLogger } from './Logger'

export type ReferentialService = ReturnType<typeof ReferentialService>

export const ReferentialService = (Logger: PartialLogger) => {
  const _logger = Logger('ReferentialService')

  return {}
}
