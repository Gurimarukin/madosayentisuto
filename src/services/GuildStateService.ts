// import { Guild, Role } from 'discord.js'
// import { flow, pipe } from 'fp-ts/function'
// import { Lens } from 'monocle-ts'

// import { GuildId } from '../models/GuildId'
// import { Calls } from '../models/guildState/Calls'
// import { GuildState } from '../models/guildState/GuildState'
// import { StaticCalls } from '../models/guildState/StaticCalls'
// import { TSnowflake } from '../models/TSnowflake'
// import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
// import { ChannelUtils } from '../utils/ChannelUtils'
// import { Future, Maybe } from '../utils/fp'
// import { DiscordConnector } from './DiscordConnector'

// // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// export const GuildStateService = (
//   // Logger: PartialLogger,
//   guildStatePersistence: GuildStatePersistence,
//   discord: DiscordConnector,
// ) => {
//   // const _logger = Logger('GuildStateService')

//   return {
//     setCalls: (guild: Guild, calls: Calls): Future<boolean> =>
//       set(guild, GuildState.Lens.calls, Maybe.some(StaticCalls.fromCalls(calls))),

//     getCalls: (guild: Guild): Future<Maybe<Calls>> =>
//       get(
//         guild,
//         s => s.calls,
//         ({ message, channel, role }) =>
//           pipe(
//             Future.Do,
//             Future.bind('message', () => discord.fetchMessage(guild, message)),

//             Future.bind('channel', () =>
//               pipe(discord.fetchChannel(channel), Future.map(Maybe.filter(ChannelUtils.isText))),
//             ),
//             Future.bind('role', () => discord.fetchRole(guild, role)),
//             Future.map(({ message: m, channel: c, role: r }) =>
//               pipe(
//                 Maybe.Do,
//                 Maybe.bind('message', () => m),
//                 Maybe.bind('channel', () => c),
//                 Maybe.bind('role', () => r),
//               ),
//             ),
//           ),
//       ),

//     setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
//       set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

//     getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
//       get(
//         guild,
//         s => s.defaultRole,
//         id => discord.fetchRole(guild, id),
//       ),
//   }

//   function set<A>(guild: Guild, lens: Lens<GuildState, A>, a: A): Future<boolean> {
//     const guildId = GuildId.wrap(guild.id)
//     return pipe(
//       guildStatePersistence.find(guildId),
//       Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
//       Future.map(lens.set(a)),
//       Future.chain(s => guildStatePersistence.upsert(guildId, s)),
//     )
//   }

//   function get<A, B>(
//     guild: Guild,
//     getter: (state: GuildState) => Maybe<A>,
//     fetch: (a: A) => Future<Maybe<B>>,
//   ): Future<Maybe<B>> {
//     return pipe(
//       guildStatePersistence.find(GuildId.wrap(guild.id)),
//       Future.chain(
//         flow(
//           Maybe.chain(getter),
//           Maybe.fold(() => Future.right(Maybe.none), fetch),
//         ),
//       ),
//     )
//   }
// }

// export type GuildStateService = ReturnType<typeof GuildStateService>
