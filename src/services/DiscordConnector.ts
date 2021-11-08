import { REST } from '@discordjs/rest'
import { RESTPostAPIApplicationCommandsJSONBody, Routes } from 'discord-api-types/v9'
import {
  ApplicationCommand,
  ApplicationCommandPermissions,
  Channel,
  Client,
  ClientApplication,
  ClientPresence,
  Collection,
  CommandInteraction,
  DiscordAPIError,
  Guild,
  GuildApplicationCommandPermissionData,
  GuildAuditLogsEntry,
  GuildMember,
  Intents,
  InteractionReplyOptions,
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
import { Separated } from 'fp-ts/Separated'
import * as D from 'io-ts/Decoder'

import { ClientConfig } from '../config/Config'
import { globalConfig } from '../globalConfig'
import { Activity } from '../models/Activity'
import { CommandId } from '../models/CommandId'
import { GuildId } from '../models/GuildId'
import { PutCommandResult } from '../models/PutCommandResult'
import { TSnowflake } from '../models/TSnowflake'
import { ChannelUtils } from '../utils/ChannelUtils'
import { Colors } from '../utils/Colors'
import { decodeError } from '../utils/decodeError'
import { Either, Future, IO, List, Maybe } from '../utils/fp'

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

  fetchApplication: (): Future<ClientApplication> =>
    Future.tryCatch(() => client.application.fetch()),

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

  getGuild: (guildId: GuildId): Maybe<Guild> =>
    Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId))),

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

const fetchCommand = (guild: Guild, commandId: CommandId): Future<ApplicationCommand> =>
  Future.tryCatch(() => guild.commands.fetch(CommandId.unwrap(commandId)))

const fetchMember = (guild: Guild, memberId: TSnowflake): Future<Maybe<GuildMember>> =>
  pipe(
    Future.tryCatch(() => guild.members.fetch(TSnowflake.unwrap(memberId))),
    Future.map(Maybe.some),
    debugLeft('fetchMember'),
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

const hasRole = (member: GuildMember, role: Role): boolean => member.roles.cache.has(role.id)

/**
 * Write
 */

const addRole = (
  member: GuildMember,
  roleOrRoles: RoleResolvable | List<RoleResolvable>,
  reason?: string,
): Future<boolean> =>
  pipe(
    Future.tryCatch(() => member.roles.add(roleOrRoles, reason)),
    Future.map(() => true),
    Future.recover(e => (isMissingPermissionsError(e) ? Future.right(false) : Future.left(e))),
    debugLeft('addRole'),
  )

const deferReply = (interaction: CommandInteraction): Future<void> =>
  Future.tryCatch(() => interaction.deferReply())

const deleteMessage = (message: Message): Future<boolean> =>
  pipe(
    Future.tryCatch(() => message.delete()),
    Future.map(() => true),
    Future.recover(e => (isMissingPermissionsError(e) ? Future.right(false) : Future.left(e))),
  )

const guildCommandsPermissionsSet = (
  guild: Guild,
  fullPermissions: List<GuildApplicationCommandPermissionData>,
): Future<Collection<string, List<ApplicationCommandPermissions>>> =>
  Future.tryCatch(() =>
    guild.commands.permissions.set({
      // eslint-disable-next-line functional/prefer-readonly-type
      fullPermissions: fullPermissions as GuildApplicationCommandPermissionData[],
    }),
  )

const interactionDeleteReply = (interaction: CommandInteraction): Future<void> =>
  Future.tryCatch(() => interaction.deleteReply())

const interactionReply = (
  interaction: CommandInteraction,
  options: string | MessagePayload | InteractionReplyOptions,
): Future<void> => Future.tryCatch(() => interaction.reply(options))

const restPutApplicationGuildCommands = (
  rest: REST,
  clientId: string,
  guildId: GuildId,
  commands: List<RESTPostAPIApplicationCommandsJSONBody>,
): Future<Separated<ReadonlyArray<Error>, List<PutCommandResult>>> =>
  pipe(
    Future.tryCatch(() =>
      rest.put(Routes.applicationGuildCommands(clientId, GuildId.unwrap(guildId)), {
        body: commands,
      }),
    ),
    Future.chain(u =>
      pipe(
        D.UnknownArray.decode(u),
        Either.mapLeft(decodeError('UnknownArray')(u)),
        Future.fromEither,
      ),
    ),
    Future.map(
      List.partitionMap(u =>
        pipe(PutCommandResult.codec.decode(u), Either.mapLeft(decodeError('PutCommandResult')(u))),
      ),
    ),
  )

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
  options: MessageOptions = {},
): Future<Maybe<Message>> =>
  sendMessage(channel, {
    ...options,
    embeds: [
      new MessageEmbed().setColor(Colors.darkred).setDescription(message),
      ...(options.embeds ?? []),
    ],
  })

/**
 * DiscordConnector
 */

export const DiscordConnector = {
  of,

  fetchAuditLogs,
  fetchCommand,
  fetchMember,
  fetchMessage,
  fetchPartial,
  fetchRole,
  hasRole,

  addRole,
  deferReply,
  deleteMessage,
  guildCommandsPermissionsSet,
  interactionDeleteReply,
  interactionReply,
  restPutApplicationGuildCommands,
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

const isMissingPermissionsError = (e: Error): e is DiscordAPIError =>
  e instanceof DiscordAPIError && e.message === 'Missing Permissions'

const debugLeft = <A>(functionName: string): ((f: Future<A>) => Future<A>) =>
  Future.mapLeft(e => {
    const constr = Object.getPrototypeOf(e).contructor
    return Error(
      `"${functionName}"\n${nl(constr?.name)}${e.stack !== undefined ? e.stack : e.message}`,
    )
  })
const nl = (str: string | undefined): string => (str !== undefined ? `${str}\n` : '')

const fetchMessageRec =
  (message: string) =>
  (channels: List<TextChannel>): Future<Maybe<Message>> => {
    if (List.isNonEmpty(channels)) {
      const [head, ...tail] = channels
      return pipe(
        Future.tryCatch(() => head.messages.fetch(message)),
        Future.map(Maybe.some),
        Future.recover(e =>
          e instanceof DiscordAPIError && e.message === 'Unknown Message'
            ? Future.right<Maybe<Message>>(Maybe.none)
            : Future.left(e),
        ),
        Future.chain(
          Maybe.fold(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right)),
        ),
      )
    }
    return Future.right(Maybe.none)
  }
