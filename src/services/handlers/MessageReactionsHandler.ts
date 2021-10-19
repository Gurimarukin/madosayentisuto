// import {
//   GuildEmoji,
//   GuildMember,
//   Message,
//   MessageReaction,
//   PartialMessage,
//   PartialUser,
//   ReactionEmoji,
//   User,
// } from 'discord.js'
// import { pipe } from 'fp-ts/function'

// import { callsEmoji } from '../../global'
// import { AddRemove } from '../../models/AddRemove'
// import { Calls } from '../../models/guildState/Calls'
// import { Future, Maybe } from '../../utils/fp'
// import { LogUtils } from '../../utils/LogUtils'
// import { DiscordConnector } from '../DiscordConnector'
// import { GuildStateService } from '../GuildStateService'
// import { PartialLogger } from '../Logger'

// export const MessageReactionsHandler = (
//   Logger: PartialLogger,
//   guildStateService: GuildStateService,
//   discord: DiscordConnector,
// ): ((event: AddRemove<readonly [MessageReaction, User | PartialUser]>) => Future<unknown>) => {
//   const logger = Logger('MessageReactionsHandler')

//   return event => {
//     const [reaction, user] = event.value
//     return isCallsEmoji(reaction.emoji)
//       ? pipe(
//           Maybe.fromNullable(reaction.message.guild),
//           Maybe.fold(
//             () => Future.unit, // not a Guild message
//             guild =>
//               pipe(
//                 guildStateService.getCalls(guild),
//                 Future.chain(
//                   Maybe.fold(
//                     () => Future.unit, // no Calls associated to this Guild
//                     calls =>
//                       pipe(
//                         Future.of(user), // discord.fetchPartial(user),
//                         Future.chain(u => discord.fetchMemberForUser(guild, u.id)),
//                         Future.chain(
//                           Maybe.fold(
//                             () => Future.unit, // couldn't retrieve GuildMember
//                             member =>
//                               isCallsMessage(calls, reaction.message)
//                                 ? pipe(
//                                     event,
//                                     AddRemove.fold({
//                                       onAdd: onAdd(member, calls),
//                                       onRemove: onRemove(member, calls),
//                                     }),
//                                   )
//                                 : Future.unit, // a reaction, but not to Calls' message
//                           ),
//                         ),
//                       ),
//                   ),
//                 ),
//               ),
//           ),
//         )
//       : Future.unit
//   }

//   function isCallsEmoji(emoji: GuildEmoji | ReactionEmoji): boolean {
//     return emoji.name === callsEmoji
//   }

//   function isCallsMessage(calls: Calls, message: Message | PartialMessage): boolean {
//     return calls.message.id === message.id
//   }

//   function onAdd(member: GuildMember, calls: Calls): (_: unknown) => Future<unknown> {
//     return () =>
//       pipe(
//         discord.addRole(member, calls.role),
//         Future.chain(() =>
//           Future.fromIOEither(
//             LogUtils.withGuild(
//               logger,
//               'debug',
//               member.guild,
//             )(`"${member.user.tag}" subscribed to calls (added to role "${calls.role.name}")`),
//           ),
//         ),
//       )
//   }

//   function onRemove(member: GuildMember, calls: Calls): (_: unknown) => Future<unknown> {
//     return () =>
//       pipe(
//         discord.removeRole(member, calls.role),
//         Future.chain(() =>
//           Future.fromIOEither(
//             LogUtils.withGuild(
//               logger,
//               'debug',
//               member.guild,
//             )(
//               `"${member.user.tag}" unsubscribed from calls (removed from role "${calls.role.name}")`,
//             ),
//           ),
//         ),
//       )
//   }
// }
