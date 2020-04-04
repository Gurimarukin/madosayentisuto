export type Reducer<State, Action> = (state: State, action: Action) => State
export type Dispatcher<Action> = (action: Action) => IO<void>

export interface Store<State, Action> {
  getState: () => IO<State>
  dispatch: Dispatcher<Action>
}

export const Store = <State, Action>(
  reducer: Reducer<State, Action>,
  initialState: State
): Store<State, Action> => {
  let state: State = initialState

  function getState(): IO<State> {
    return IO.right(state)
  }

  function dispatch(action: Action): IO<void> {
    return pipe(
      IO.apply(() => (state = reducer(state, action))),
      IO.map(_ => {})
    )
  }

  return { getState, dispatch }
}
