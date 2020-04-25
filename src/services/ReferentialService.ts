import { Guild, Channel } from 'discord.js'
import { createStore } from 'redux'

import { PartialLogger } from './Logger'
import { TSnowflake } from '../models/TSnowflake'
import { ReferentialReducer } from '../store/referential/ReferentialReducer'
import { pipe, Dict, Maybe, IO } from '../utils/fp'
import { ReferentialAction } from '../store/referential/ReferentialAction'

export type ReferentialService = ReturnType<typeof ReferentialService>

export const ReferentialService = (Logger: PartialLogger) => {
  const logger = Logger('ReferentialService')

  const store = createStore(ReferentialReducer)

  store.subscribe(() =>
    pipe(
      store.getState(),
      state => logger.debug('State changed to:\ncallsSubscription:', state.callsSubscription),
      IO.runUnsafe
    )
  )

  const subscribedChannels = (guild: Guild): TSnowflake[] =>
    pipe(
      store.getState().callsSubscription,
      _ => Dict.lookup(guild.id, _),
      Maybe.fold(
        () => [],
        _ => _.channels
      )
    )

  const ignoredUsers = (guild: Guild): TSnowflake[] =>
    pipe(
      store.getState().callsSubscription,
      _ => Dict.lookup(guild.id, _),
      Maybe.fold(
        () => [],
        _ => _.ignoredUsers
      )
    )

  const subscribe = (guild: Guild, channel: Channel): void => {
    store.dispatch(
      ReferentialAction.CallsSubscribe(TSnowflake.wrap(guild.id), TSnowflake.wrap(channel.id))
    )
  }

  return { subscribedChannels, ignoredUsers, subscribe }
}
