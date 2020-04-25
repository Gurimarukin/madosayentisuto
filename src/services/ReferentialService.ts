import { Guild, Channel } from 'discord.js'
import { createStore } from 'redux'

import { PartialLogger } from './Logger'
import { TSnowflake } from '../models/TSnowflake'
import { Referential } from '../models/referential/Referential'
import { ReferentialPersistence } from '../persistence/ReferentialPersistence'
import { ReferentialAction } from '../store/referential/ReferentialAction'
import { ReferentialReducer } from '../store/referential/ReferentialReducer'
import { pipe, Dict, Maybe, IO, Future, Task, Either } from '../utils/fp'

export interface ReferentialService {
  subscribedChannels: (guild: Guild) => TSnowflake[]
  ignoredUsers: (guild: Guild) => TSnowflake[]
  subscribeCalls: (guild: Guild, channel: Channel) => void
  ignoreCallsFrom: (guild: Guild, user: TSnowflake) => void
}

export const ReferentialService = (
  Logger: PartialLogger,
  referentialPersistence: ReferentialPersistence
): Future<ReferentialService> =>
  pipe(
    referentialPersistence.get(),
    Future.chain(initState => {
      const logger = Logger('ReferentialService')

      const store = createStore(
        ReferentialReducer(
          pipe(
            initState,
            Maybe.getOrElse(() => Referential.empty)
          )
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

      const subscribeCalls = (guild: Guild, channel: Channel): void => {
        store.dispatch(
          ReferentialAction.CallsSubscribe(TSnowflake.wrap(guild.id), TSnowflake.wrap(channel.id))
        )
      }

      const ignoreCallsFrom = (guild: Guild, user: TSnowflake): void => {
        store.dispatch(ReferentialAction.CallsIgnore(TSnowflake.wrap(guild.id), user))
      }

      return pipe(
        IO.apply(() =>
          store.subscribe(() => {
            const state = store.getState()
            pipe(
              logger.debug('State changed to:\ncallsSubscription:', state.callsSubscription),
              Future.fromIOEither,
              Future.chain(_ => referentialPersistence.set(state)),
              // TODO: retry if failed ?
              Task.chain(
                Either.fold(
                  e => pipe(logger.error(e.stack), Future.fromIOEither),
                  _ => Future.unit
                )
              ),
              Future.runUnsafe
            )
          })
        ),
        IO.map(() => ({ subscribedChannels, ignoredUsers, subscribeCalls, ignoreCallsFrom })),
        Future.fromIOEither
      )
    })
  )
