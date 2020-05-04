import { Referential } from '../../src/models/referential/Referential'
import { ReferentialReducer } from '../../src/store/referential/ReferentialReducer'

describe('Referential store', () => {
  it('should init store', () => {
    const store = ReferentialReducer.createStore(Referential.empty)
    expect(store.getState()).toEqual({ callsSubscription: {} })
  })

  // it('should dispatch CallsSubscribe', () => {
  //   const store
  // })
})
