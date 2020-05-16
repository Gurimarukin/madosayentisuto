import { createStore as reduxCreateStore, Reducer } from 'redux'

import { PlayerAction } from './PlayerAction'
import { GuildId } from '../../models/GuildId'
import { PlayerState, PlayerGuildState } from '../../models/PlayerState'
import { Maybe, Dict, flow, todo } from '../../utils/fp'

export function PlayerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  if (action.type.startsWith('@@redux')) return state

  switch (action.type) {
    case 'SetLock':
      return update(
        action.guildId,
        flow(
          PlayerGuildState.Lens.preloadLocked.set(true),
          PlayerGuildState.Lens.preloadMessage.set(Maybe.some(action.message))
        )
      )(state)

    case 'DeleteMessage':
      return update(action.guildId, PlayerGuildState.Lens.preloadMessage.set(Maybe.none))(state)

    case 'SetConnection':
      return update(
        action.guildId,
        PlayerGuildState.Lens.connection.set(Maybe.some(action.connection))
      )(state)

    case 'Enqueue':
      return todo()
  }
}

const update = (
  guildId: GuildId,
  update: (prev: PlayerGuildState) => PlayerGuildState
): ((state: PlayerState) => PlayerState) =>
  Dict.insertOrUpdateAt(GuildId.unwrap(guildId), () => update(PlayerGuildState.empty), update)

export namespace PlayerReducer {
  export const createStore = (init: PlayerState) =>
    reduxCreateStore(PlayerReducer as Reducer<PlayerState, PlayerAction>, init)
}
