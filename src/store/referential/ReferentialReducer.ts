// import { Lens } from 'monocle-ts'
// import { createStore as reduxCreateStore, Reducer } from 'redux'

// import { ReferentialAction } from './ReferentialAction'
// import { GuildReferential } from '../../models/referential/GuildReferential'
// import { Referential } from '../../models/referential/Referential'
// import { TSnowflake } from '../../models/TSnowflake'
// import { Dict, Maybe, pipe } from '../../utils/fp'

// export function ReferentialReducer(state: Referential, action: ReferentialAction): Referential {
//   if (action.type.startsWith('@@redux')) return state

//   switch (action.type) {
//     case 'SetDefaultRole':
//       return pipe(state, updateGuild(action.guild, defaultRoleLens.set(Maybe.some(action.role))))
//   }
// }

// export namespace ReferentialReducer {
//   export const createStore = (init: Referential) =>
//     reduxCreateStore(ReferentialReducer as Reducer<Referential, ReferentialAction>, init)
// }

// // const snowflakeEq = fromEquals<TSnowflake>((x, y) => x === y)

// const updateGuild = (
//   guild: TSnowflake,
//   update: (a: GuildReferential) => GuildReferential
// ): ((state: Referential) => Referential) =>
//   Dict.insertOrUpdateAt(TSnowflake.unwrap(guild), update(GuildReferential.empty), update)

// const defaultRoleLens = Lens.fromPath<GuildReferential>()(['defaultRole'])
