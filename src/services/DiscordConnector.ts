import {
  Channel,
  Client,
  ClientPresence,
  Collection,
  CommandInteraction,
  DiscordAPIError,
  Guild,
  GuildAuditLogsEntry,
  GuildMember,
  Intents,
  Message,
  MessageEmbed,
  MessageOptions,
  MessagePayload,
  PartialTextBasedChannelFields,
  Role,
  RoleResolvable,
  TextChannel,
  User,
} from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { ClientConfig } from '../config/Config'
import { globalConfig } from '../globalConfig'
import { Activity } from '../models/Activity'
import { TSnowflake } from '../models/TSnowflake'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Colors } from '../utils/Colors'
import { Future, IO, List, Maybe } from '../utils/fp'

type NotPartial = {
  readonly partial: false
}
type MyPartial<A extends NotPartial> =
  | {
      readonly partial: true
      readonly fetch: () => Promise<A>
    }
  | A

export type DiscordConnector = ReturnType<typeof of>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const of = (client: Client<true>) => ({
  client,

  /**
   * Read
   */

  fetchChannel: (channelId: TSnowflake): Future<Maybe<Channel>> =>
    pipe(
      Future.tryCatch(() => client.channels.fetch(TSnowflake.unwrap(channelId))),
      Future.map(Maybe.fromNullable),
      // Future.recover<Maybe<Channel>>(_ => Future.right(Maybe.none)),
      debugLeft('fetchChannel'),
      //   [
      //   e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
      //   Maybe.none
      // ]
    ),

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
})

// return {
//   clientUser: Maybe.fromNullable(client.user),

//   resolveGuild: (guildId: GuildId): Maybe<Guild> =>
//     Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId))),

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

//   /**
//    * Write
//    */

//   reactMessage: (message: Message, emoji: EmojiIdentifierResolvable): Future<MessageReaction> =>
//     Future.tryCatch(() => message.react(emoji)),

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

/**
 * Read
 */

const fetchAuditLogs = (guild: Guild): Future<Collection<string, GuildAuditLogsEntry>> =>
  pipe(
    Future.tryCatch(() => guild.fetchAuditLogs({ limit: globalConfig.fetchLogsLimit })),
    Future.map(logs => logs.entries),
  )

const fetchMessage = (guild: Guild, messageId: TSnowflake): Future<Maybe<Message>> =>
  pipe(
    guild.channels.cache.toJSON(),
    List.filter(ChannelUtils.isTextChannel),
    fetchMessageRec(TSnowflake.unwrap(messageId)),
  )

const fetchPartial = <A extends NotPartial>(partial: MyPartial<A>): Future<A> =>
  partial.partial ? Future.tryCatch(() => partial.fetch()) : Future.right(partial)

const fetchRole = (guild: Guild, roleId: TSnowflake): Future<Maybe<Role>> =>
  pipe(
    Future.tryCatch(() => guild.roles.fetch(TSnowflake.unwrap(roleId))),
    Future.map(Maybe.fromNullable),
  )

/**
 * Write
 */

const addRole = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<Maybe<void>> =>
  pipe(
    Future.tryCatch(() => member.roles.add(roleOrRoles, reason)),
    Future.map(() => Maybe.some(undefined)),
    debugLeft('addRole'),
    // [e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
    // Maybe.none]
    // Future.map(_ => {}),
  )

const deferReply = (interaction: CommandInteraction): Future<void> =>
  Future.tryCatch(() => interaction.deferReply())

const sendMessage = (
  channel: PartialTextBasedChannelFields,
  options: string | MessagePayload | MessageOptions,
): Future<Maybe<Message>> =>
  pipe(
    Future.tryCatch(() => channel.send(options)),
    Future.map(Maybe.some),
    // Future.recover<Maybe<Message>>(e =>
    //   e instanceof DiscordAPIError && e.message === 'Cannot send messages to this user'
    //     ? Future.right(Maybe.none)
    //     : Future.left(e),
    // ),
  )

const sendPrettyMessage = (
  channel: PartialTextBasedChannelFields,
  message: string,
): Future<Maybe<Message>> =>
  sendMessage(channel, {
    embeds: [new MessageEmbed().setColor(Colors.darkred).setDescription(message)],
  })

/**
 * DiscordConnector
 */

export const DiscordConnector = {
  of,
  fetchAuditLogs,
  fetchMessage,
  fetchPartial,
  fetchRole,
  addRole,
  deferReply,
  sendMessage,
  sendPrettyMessage,

  futureClient: (config: ClientConfig): Future<Client> =>
    Future.tryCatch(
      () =>
        new Promise<Client>(resolve => {
          const client = new Client({
            intents: [
              Intents.FLAGS.DIRECT_MESSAGES,
              Intents.FLAGS.GUILDS,
              Intents.FLAGS.GUILD_BANS,
              Intents.FLAGS.GUILD_MEMBERS,
              Intents.FLAGS.GUILD_MESSAGES,
              Intents.FLAGS.GUILD_VOICE_STATES,
            ],
            partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION'],
          })
          /* eslint-disable functional/no-expression-statement */
          client.once('ready', () => resolve(client))
          client.login(config.secret)
          /* eslint-enable functional/no-expression-statement */
        }),
    ),
}

/**
 * Helpers
 */

const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e =>
    Error(`${functionName}:\n${Object.getPrototypeOf(e).contructor.name}\n${e.message}`),
  )

const fetchMessageRec =
  (message: string) =>
  (channels: List<TextChannel>): Future<Maybe<Message>> => {
    if (List.isNonEmpty(channels)) {
      const [head, ...tail] = channels
      return pipe(
        Future.tryCatch(() => head.messages.fetch(message)),
        Future.map(Maybe.some),
        Future.recover<Maybe<Message>>(e =>
          e instanceof DiscordAPIError && e.message === 'Unknown Message'
            ? Future.right(Maybe.none)
            : Future.left(e),
        ),
        Future.chain(
          Maybe.fold(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right)),
        ),
      )
    }
    return Future.right(Maybe.none)
  }
