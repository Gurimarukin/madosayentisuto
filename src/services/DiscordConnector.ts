import { Client, ClientPresence, Intents, User } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { Config } from '../config/Config'
import { Activity } from '../models/Activity'
import { TSnowflake } from '../models/TSnowflake'
import { Future, IO, Maybe } from '../utils/fp'

export type DiscordConnector = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function of(client: Client<true>) {
  return {
    client,

    /**
     * Read
     */

    fetchUser: (userId: TSnowflake): Future<Maybe<User>> =>
      pipe(
        IO.tryCatch(() => client.users.cache.get(TSnowflake.unwrap(userId))),
        IO.map(Maybe.fromNullable),
        Future.fromIOEither,
        Future.chain(
          Maybe.fold(
            () =>
              pipe(
                Future.tryCatch(() => client.users.fetch(TSnowflake.unwrap(userId))),
                Future.map(Maybe.some),
              ),
            flow(Maybe.some, Future.right),
          ),
        ),
        debugLeft('fetchUser'),
      ),

    /**
     * Write
     */

    setActivity: (activity: Maybe<Activity>): IO<ClientPresence> =>
      IO.tryCatch(() =>
        pipe(
          activity,
          Maybe.fold(
            () => client.user.setActivity(),
            ({ name, type }) => client.user.setActivity(name, { type }),
          ),
        ),
      ),
  }
  // return {
  //   clientUser: Maybe.fromNullable(client.user),

  //   /**
  //    * Observables
  //    */
  //   messages: (): ObservableE<Message> =>
  //     pipe(
  //       fromEventPattern<Message>(handler => client.on('message', handler)),
  //       ObservableE.rightObservable,
  //     ),

  //   voiceStateUpdates: (): ObservableE<VoiceStateUpdate> =>
  //     pipe(
  //       fromEventPattern<VoiceStateUpdate>(handler =>
  //         client.on('voiceStateUpdate', (oldState, newState) =>
  //           handler(VoiceStateUpdate(oldState, newState)),
  //         ),
  //       ),
  //       ObservableE.rightObservable,
  //     ),

  //   guildMemberEvents: (): ObservableE<AddRemove<GuildMember | PartialGuildMember>> =>
  //     pipe(
  //       fromEventPattern<AddRemove<GuildMember | PartialGuildMember>>(handler => {
  //         /* eslint-disable functional/no-expression-statement */
  //         client.on('guildMemberAdd', member => handler(AddRemove.Add(member)))
  //         client.on('guildMemberRemove', member => handler(AddRemove.Remove(member)))
  //         /* eslint-enable functional/no-expression-statement */
  //       }),
  //       ObservableE.rightObservable,
  //     ),

  //   messageReactions: (): ObservableE<AddRemove<Tuple<MessageReaction, User | PartialUser>>> =>
  //     pipe(
  //       fromEventPattern<AddRemove<Tuple<MessageReaction, User | PartialUser>>>(handler => {
  //         /* eslint-disable functional/no-expression-statement */
  //         client.on('messageReactionAdd', (reaction, user) =>
  //           handler(AddRemove.Add([reaction, user])),
  //         )
  //         client.on('messageReactionRemove', (reaction, user) =>
  //           handler(AddRemove.Remove([reaction, user])),
  //         )
  //         /* eslint-enable functional/no-expression-statement */
  //       }),
  //       ObservableE.rightObservable,
  //     ),

  //   resolveGuild: (guildId: GuildId): Maybe<Guild> =>
  //     Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId))),

  //   // fetchPartial: <A extends FetchPartial<A>, K extends string>(partial: A | Partialize<A, K>) =>
  //   //   partial.partial ? Future.tryCatch(() => partial.fetch()) : Future.right(partial),

  //   fetchChannel: (channel: TSnowflake): Future<Maybe<Channel>> =>
  //     pipe(
  //       Future.tryCatch(() => client.channels.fetch(TSnowflake.unwrap(channel))),
  //       Future.map(Maybe.fromNullable),
  //       // Future.recover<Maybe<Channel>>(_ => Future.right(Maybe.none)),
  //       debugLeft('fetchChannel'),
  //       //   [
  //       //   e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
  //       //   Maybe.none
  //       // ]
  //     ),

  //   fetchMemberForUser: (
  //     guild: Guild,
  //     user:
  //       | UserResolvable
  //       | FetchMemberOptions
  //       | (FetchMembersOptions & { readonly user: UserResolvable }),
  //   ): Future<Maybe<GuildMember>> =>
  //     pipe(
  //       Future.tryCatch(() => guild.members.fetch(user)),
  //       Future.map(Maybe.some),
  //       Future.recover<Maybe<GuildMember>>(() => Future.right(Maybe.none)),
  //       debugLeft('fetchMemberForUser'),
  //     ),

  //   fetchRole: (guild: Guild, role: TSnowflake): Future<Maybe<Role>> =>
  //     pipe(
  //       Future.tryCatch(() => guild.roles.fetch(TSnowflake.unwrap(role))),
  //       Future.map(Maybe.fromNullable),
  //     ),

  //   fetchMessage: (guild: Guild, message: TSnowflake): Future<Maybe<Message>> =>
  //     pipe(
  //       guild.channels.cache.toJSON(),
  //       List.filter(ChannelUtils.isText),
  //       fetchMessageRec(TSnowflake.unwrap(message)),
  //     ),

  //   /**
  //    * Write
  //    */

  //   sendMessage,

  //   sendPrettyMessage: (
  //     channel: PartialTextBasedChannelFields,
  //     content: string,
  //   ): Future<Maybe<Message>> =>
  //     sendMessage(channel, {
  //       embeds: [new MessageEmbed().setColor(Colors.darkred).setDescription(content)],
  //     }),

  //   reactMessage: (message: Message, emoji: EmojiIdentifierResolvable): Future<MessageReaction> =>
  //     Future.tryCatch(() => message.react(emoji)),

  //   addRole: (
  //     member: GuildMember,
  //     roleOrRoles: RoleResolvable | List<RoleResolvable>,
  //     reason?: string,
  //   ): Future<Maybe<void>> =>
  //     pipe(
  //       Future.tryCatch(() => member.roles.add(roleOrRoles, reason)),
  //       Future.map(() => Maybe.some(undefined)),
  //       debugLeft('addRole'),
  //       // [e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
  //       // Maybe.none]
  //       // Future.map(_ => {}),
  //     ),

  //   removeRole: (
  //     member: GuildMember,
  //     roleOrRoles: RoleResolvable | List<RoleResolvable>,
  //     reason?: string,
  //   ): Future<Maybe<void>> =>
  //     pipe(
  //       Future.tryCatch(() => member.roles.remove(roleOrRoles, reason)),
  //       Future.map(() => Maybe.some(undefined)),
  //       debugLeft('removeRole'),
  //       //[ e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
  //       // Maybe.none]
  //     ),

  //   createInvite: (
  //     channel: BaseGuildTextChannel | BaseGuildVoiceChannel | StoreChannel,
  //     options?: CreateInviteOptions,
  //   ): Future<Invite> => Future.tryCatch(() => channel.createInvite(options)),

  //   deleteMessage: (message: Message): Future<boolean> =>
  //     pipe(
  //       Future.tryCatch(() => message.delete()),
  //       Future.map(() => true),
  //       Future.recover(e =>
  //         e instanceof DiscordAPIError && e.message === 'Missing Permissions'
  //           ? Future.right(false)
  //           : Future.left(e),
  //       ),
  //     ),

  //   // joinVoiceChannel: (voiceChannel: VoiceChannel): Future<VoiceConnection> =>
  //   //   pipe(
  //   //     Future.tryCatch(() => voiceChannel.join()),
  //   //     debugLeft('joinVoiceChannel'),
  //   //   ),

  //   // connectionPlay: (connection: VoiceConnection, input: string): IO<StreamDispatcher> =>
  //   //   IO.tryCatch(() => connection.play(input)),
  // }

  // function fetchMessageRec(
  //   message: string,
  // ): (channels: List<TextChannel>) => Future<Maybe<Message>> {
  //   return channels => {
  //     if (List.isNonEmpty(channels)) {
  //       const [head, ...tail] = channels
  //       return pipe(
  //         Future.tryCatch(() => head.messages.fetch(message)),
  //         Future.map(Maybe.some),
  //         Future.recover<Maybe<Message>>(e =>
  //           e instanceof DiscordAPIError && e.message === 'Unknown Message'
  //             ? Future.right(Maybe.none)
  //             : Future.left(e),
  //         ),
  //         Future.chain(
  //           Maybe.fold(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right)),
  //         ),
  //       )
  //     }
  //     return Future.right(Maybe.none)
  //   }
  // }

  // function sendMessage(
  //   channel: PartialTextBasedChannelFields,
  //   options: string | MessagePayload | MessageOptions,
  // ): Future<Maybe<Message>> {
  //   return pipe(
  //     Future.tryCatch(() => channel.send(options)),
  //     Future.map(Maybe.some),
  //     Future.recover<Maybe<Message>>(e =>
  //       e instanceof DiscordAPIError && e.message === 'Cannot send messages to this user'
  //         ? Future.right(Maybe.none)
  //         : Future.left(e),
  //     ),
  //   )
  // }

  function debugLeft<A>(functionName: string): (f: Future<A>) => Future<A> {
    return Future.mapLeft(e =>
      Error(`${functionName}:\n${Object.getPrototypeOf(e).contructor.name}\n${e.message}`),
    )
  }
}

export const DiscordConnector = {
  of,
  futureClient: (config: Config): Future<Client> =>
    Future.tryCatch(
      () =>
        new Promise<Client>(resolve => {
          const client = new Client({
            intents: [
              Intents.FLAGS.GUILDS,
              Intents.FLAGS.GUILD_MEMBERS,
              Intents.FLAGS.GUILD_BANS,
              // Intents.FLAGS.DIRECT_MESSAGES,
            ],
            partials: ['USER'],
          })
          /* eslint-disable functional/no-expression-statement */
          client.on('ready', () => resolve(client))
          client.login(config.clientSecret)
          /* eslint-enable functional/no-expression-statement */
        }),
    ),
}
