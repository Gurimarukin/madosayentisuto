import { Guild, GuildMember } from 'discord.js'

import { PartialLogger } from './Logger'
import { TSnowflake } from '../models/TSnowflake'

export type ReferentialService = ReturnType<typeof ReferentialService>

export const ReferentialService = (Logger: PartialLogger) => {
  const _logger = Logger('ReferentialService')

  const channelsToSpamOnCall = (_onCallIn: Guild, _calledBy: GuildMember): TSnowflake[] => [
    TSnowflake.wrap('123')
  ]

  return { channelsToSpamOnCall }
}
