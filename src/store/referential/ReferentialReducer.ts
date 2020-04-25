import { fromEquals } from 'fp-ts/lib/Eq'
import { Lens } from 'monocle-ts'
import { Reducer } from 'redux'

import { ReferentialAction } from './ReferentialAction'
import { CallsSubscription } from '../../models/referential/CallsSubscription'
import { Referential } from '../../models/referential/Referential'
import { TSnowflake } from '../../models/TSnowflake'
import { pipe, Dict, List } from '../../utils/fp'

const initReferential: Referential = {
  callsSubscription: {}
}

export const ReferentialReducer: Reducer<Referential, ReferentialAction> = (
  state = initReferential,
  action
) => {
  if (action.type === 'CallsSubscribe') {
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
  }

  if (action.type === 'CallsIgnore') {
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

  return state
}

const snowflakeEq = fromEquals<TSnowflake>((x, y) => x === y)

const spamSubscriptionsLens = Lens.fromPath<Referential>()(['callsSubscription'])
