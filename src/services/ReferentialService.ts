import { Guild, GuildMember } from 'discord.js'
import { createStore } from 'redux'

import { PartialLogger } from './Logger'
import { TSnowflake } from '../models/TSnowflake'
import { ReferentialReducer } from '../store/referential/ReferentialReducer'

export type ReferentialService = ReturnType<typeof ReferentialService>

export const ReferentialService = (Logger: PartialLogger) => {
  const _logger = Logger('ReferentialService')

  const store = createStore(ReferentialReducer)
  console.log('store.getState() =', store.getState())

  const channelsToSpamOnCall = (_onCallIn: Guild, _calledBy: GuildMember): TSnowflake[] => [
    TSnowflake.wrap('123')
  ]

  return { channelsToSpamOnCall }
}
