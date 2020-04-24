import { fromEquals } from 'fp-ts/lib/Eq'
import { Lens } from 'monocle-ts'
import { Reducer } from 'redux'

import { ReferentialAction } from './ReferentialAction'
import { Referential } from '../../models/referential/Referential'
import { TSnowflake } from '../../models/TSnowflake'
import { pipe, Dict, List } from '../../utils/fp'

const initReferential: Referential = {
  spamSubscriptions: {}
}

export const ReferentialReducer: Reducer<Referential, ReferentialAction> = (
  state = initReferential,
  action
) => {
  if (action.type === 'SubscribeToSpam') {
    return spamSubscriptionsLens.modify(
      Dict.insertOrUpdateAt(
        TSnowflake.unwrap(action.guild),
        { channels: [action.channel], ignoredUsers: [] as TSnowflake[] },
        _ => ({
          channels: pipe(
            List.snoc(_.channels, action.channel),
            List.uniq(fromEquals((x, y) => x === y))
          ),
          ignoredUsers: _.ignoredUsers
        })
      )
    )(state)
  }

  return state
}

const spamSubscriptionsLens = Lens.fromPath<Referential>()(['spamSubscriptions'])
