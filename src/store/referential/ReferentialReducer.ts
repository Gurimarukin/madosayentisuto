import { fromEquals } from 'fp-ts/lib/Eq'
import { Lens } from 'monocle-ts'
import { createStore as reduxCreateStore, Reducer } from 'redux'

import { ReferentialAction } from './ReferentialAction'
import { CallsSubscription } from '../../models/referential/CallsSubscription'
import { Referential } from '../../models/referential/Referential'
import { TSnowflake } from '../../models/TSnowflake'
import { pipe, Dict, List } from '../../utils/fp'

export function ReferentialReducer(state: Referential, action: ReferentialAction) {
  if (action.type.startsWith('@@redux')) return state
  console.log('action =', action)

  switch (action.type) {
    case 'CallsSubscribe':
      return spamSubscriptionsLens.modify(
        Dict.insertOrUpdateAt(
          TSnowflake.unwrap(action.guild),
          CallsSubscription([action.channel], []),
          prev =>
            CallsSubscription(
              pipe(List.snoc(prev.channels, action.channel), List.uniq(snowflakeEq)),
              prev.ignoredUsers
            )
        )
      )(state)

    case 'CallsUnsubscribe':
      return spamSubscriptionsLens.modify(
        Dict.insertOrUpdateAt(TSnowflake.unwrap(action.guild), CallsSubscription([], []), prev =>
          CallsSubscription(
            prev.channels.filter(_ => _ !== action.channel),
            prev.ignoredUsers
          )
        )
      )(state)

    case 'CallsIgnore':
      return spamSubscriptionsLens.modify(
        Dict.insertOrUpdateAt(
          TSnowflake.unwrap(action.guild),
          CallsSubscription([], [action.user]),
          prev =>
            CallsSubscription(
              prev.channels,
              pipe(List.snoc(prev.ignoredUsers, action.user), List.uniq(snowflakeEq))
            )
        )
      )(state)
  }
}

export namespace ReferentialReducer {
  export const createStore = (init: Referential) =>
    reduxCreateStore(ReferentialReducer as Reducer<Referential, ReferentialAction>, init)
}

const snowflakeEq = fromEquals<TSnowflake>((x, y) => x === y)

const spamSubscriptionsLens = Lens.fromPath<Referential>()(['callsSubscription'])
