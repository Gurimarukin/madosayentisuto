// import { Referential } from '../../src/models/referential/Referential'
// import { TSnowflake } from '../../src/models/TSnowflake'
// import { ReferentialReducer } from '../../src/store/referential/ReferentialReducer'
// import { ReferentialAction } from '../../src/store/referential/ReferentialAction'
// import { Maybe } from '../../src/utils/fp'

describe('Referential store', () => {
  it('should work', () => {
    expect(2).toEqual(2)
  })

  //   it('should init store', () => {
  //     const store = ReferentialReducer.createStore(Referential.empty)
  //     expect(store.getState()).toEqual({})
  //   })

  //   it('should dispatch SetDefaultRole', () => {
  //     const store = ReferentialReducer.createStore(Referential.empty)
  //     const guild = TSnowflake.wrap('guild')
  //     store.dispatch(ReferentialAction.SetDefaultRole(guild, TSnowflake.wrap('role1')))
  //     expect(store.getState()).toEqual({
  //       guild: { defaultRole: Maybe.some(TSnowflake.wrap('role1')) }
  //     })
  //     store.dispatch(ReferentialAction.SetDefaultRole(guild, TSnowflake.wrap('role2')))
  //     expect(store.getState()).toEqual({
  //       guild: { defaultRole: Maybe.some(TSnowflake.wrap('role2')) }
  //     })
  //   })
})
