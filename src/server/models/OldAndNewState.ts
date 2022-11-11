type OldAndNewState<A, B = A> = {
  readonly oldState: A
  readonly newState: B
}

const OldAndNewState = <A, B = A>(oldState: A, newState: B): OldAndNewState<A, B> => ({
  oldState,
  newState,
})

export { OldAndNewState }
