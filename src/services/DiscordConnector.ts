import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  ActivityOptions,
  Channel,
  Client,
  DiscordAPIError,
  EmojiIdentifierResolvable,
  Guild,
  GuildChannel,
  GuildMember,
  Invite,
  InviteOptions,
  Message,
  MessageAdditions,
  MessageEmbed,
  MessageOptions,
  MessageReaction,
  PartialGuildMember,
  Partialize,
  PartialTextBasedChannelFields,
  PartialUser,
  Presence,
  Role,
  RoleResolvable,
  StringResolvable,
  TextChannel,
  User,
  UserResolvable
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { Config } from '../config/Config'
import { AddRemove } from '../models/AddRemove'
import { GuildId } from '../models/GuildId'
import { ObservableE } from '../models/ObservableE'
import { TSnowflake } from '../models/TSnowflake'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { Maybe, pipe, Future, flow, List } from '../utils/fp'
import { Colors } from '../utils/Colors'
import { ChannelUtils } from '../utils/ChannelUtils'

export type DiscordConnector = ReturnType<typeof DiscordConnector>

export function DiscordConnector(client: Client) {
  return {
    isSelf: (user: User): boolean =>
      pipe(
        Maybe.fromNullable(client.user),
        Maybe.exists(_ => _.id === user.id)
      ),

    /**
     * Observables
     */
    messages: (): ObservableE<Message> =>
      pipe(
        fromEventPattern<Message>(handler => client.on('message', handler)),
        Obs.rightObservable
      ),

    voiceStateUpdates: (): ObservableE<VoiceStateUpdate> =>
      pipe(
        fromEventPattern<VoiceStateUpdate>(handler =>
          client.on('voiceStateUpdate', (oldState, newState) =>
            handler(VoiceStateUpdate(oldState, newState))
          )
        ),
        Obs.rightObservable
      ),

    guildMemberEvents: (): ObservableE<AddRemove<GuildMember | PartialGuildMember>> =>
      pipe(
        fromEventPattern<AddRemove<GuildMember | PartialGuildMember>>(handler => {
          client.on('guildMemberAdd', member => handler(AddRemove.Add(member)))
          client.on('guildMemberRemove', member => handler(AddRemove.Remove(member)))
        }),
        Obs.rightObservable
      ),

    messageReactions: (): ObservableE<AddRemove<[MessageReaction, User | PartialUser]>> =>
      pipe(
        fromEventPattern<AddRemove<[MessageReaction, User | PartialUser]>>(handler => {
          client.on('messageReactionAdd', (reaction, user) =>
            handler(AddRemove.Add([reaction, user]))
          )
          client.on('messageReactionRemove', (reaction, user) =>
            handler(AddRemove.Remove([reaction, user]))
          )
        }),
        Obs.rightObservable
      ),

    /**
     * Read
     */
    resolveGuild: (guildId: GuildId): Maybe<Guild> =>
      Maybe.fromNullable(client.guilds.cache.get(GuildId.unwrap(guildId))),

    fetchPartial: <A extends { partial: boolean; fetch(): Promise<A> }, K extends string>(
      partial: A | Partialize<A, K>
    ) => (partial.partial ? Future.apply(() => partial.fetch()) : Future.right(partial)),

    fetchChannel: (channel: TSnowflake): Future<Maybe<Channel>> =>
      pipe(
        Future.apply(() => client.channels.fetch(TSnowflake.unwrap(channel))),
        Future.map(Maybe.some),
        Future.recover<Maybe<Channel>>(),
        debugLeft('fetchChannel')
        //   [
        //   e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
        //   Maybe.none
        // ]
      ),

    fetchUser: (user: TSnowflake): Future<Maybe<User>> =>
      pipe(
        Future.apply(() => client.users.fetch(TSnowflake.unwrap(user))),
        Future.map(Maybe.some),
        Future.recover<Maybe<User>>(),
        debugLeft('fetchUser')
        //   [
        //   e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
        //   Maybe.none
        // ]
      ),

    fetchMemberForUser: (guild: Guild, user: UserResolvable): Future<Maybe<GuildMember>> =>
      pipe(
        Future.apply(() => guild.members.fetch(user)),
        Future.map(Maybe.some),
        Future.recover<Maybe<GuildMember>>(),
        debugLeft('fetchMemberForUser')
      ),

    fetchRole: (guild: Guild, role: TSnowflake): Future<Maybe<Role>> =>
      pipe(
        Future.apply(() => guild.roles.fetch(TSnowflake.unwrap(role))),
        Future.map(Maybe.fromNullable)
      ),

    fetchMessage: (guild: Guild, message: TSnowflake): Future<Maybe<Message>> =>
      pipe(
        guild.channels.cache.array(),
        List.filter(ChannelUtils.isText),
        fetchMessageRec(TSnowflake.unwrap(message))
      ),

    /**
     * Write
     */
    setActivity: (name: string, options?: ActivityOptions): Future<Maybe<Presence>> =>
      pipe(
        Maybe.fromNullable(client.user),
        Maybe.fold(
          () => Future.right(Maybe.none),
          _ =>
            pipe(
              Future.apply(() => _.setActivity(name, options)),
              Future.map(Maybe.fromNullable)
            )
        )
      ),

    sendMessage,

    sendPrettyMessage: (
      channel: PartialTextBasedChannelFields,
      content: string,
      options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
    ): Future<Maybe<Message>> =>
      sendMessage(
        channel,
        new MessageEmbed().setColor(Colors.darkred).setDescription(content),
        options
      ),

    reactMessage: (message: Message, emoji: EmojiIdentifierResolvable): Future<MessageReaction> =>
      Future.apply(() => message.react(emoji)),

    addRole: (
      member: GuildMember,
      roleOrRoles: RoleResolvable | RoleResolvable[],
      reason?: string
    ): Future<Maybe<void>> =>
      pipe(
        Future.apply(() => member.roles.add(roleOrRoles, reason)),
        Future.map(_ => Maybe.some(undefined)),
        Future.recover<Maybe<void>>(),
        debugLeft('addRole')
        // [e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
        // Maybe.none]
        // Future.map(_ => {}),
      ),

    removeRole: (
      member: GuildMember,
      roleOrRoles: RoleResolvable | RoleResolvable[],
      reason?: string
    ): Future<Maybe<void>> =>
      pipe(
        Future.apply(() => member.roles.remove(roleOrRoles, reason)),
        Future.map(_ => Maybe.some(undefined)),
        Future.recover<Maybe<void>>(),
        debugLeft('removeRole')
        //[ e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
        // Maybe.none]
      ),

    createInvite: (channel: GuildChannel, options?: InviteOptions): Future<Invite> =>
      Future.apply(() => channel.createInvite(options)),

    deleteMessage: (message: Message): Future<boolean> =>
      pipe(
        Future.apply(() => message.delete()),
        Future.map(_ => true),
        Future.recover<boolean>([
          e => e instanceof DiscordAPIError && e.message === 'Missing Permissions',
          false
        ])
      )
  }

  function fetchMessageRec(message: string): (channels: TextChannel[]) => Future<Maybe<Message>> {
    return channels => {
      if (List.isEmpty(channels)) return Future.right(Maybe.none)

      const [head, ...tail] = channels
      return pipe(
        Future.apply(() => head.messages.fetch(message)),
        Future.map(Maybe.some),
        Future.recover<Maybe<Message>>([
          e => e instanceof DiscordAPIError && e.message === 'Unknown Message',
          Maybe.none
        ]),
        Future.chain(
          Maybe.fold(() => fetchMessageRec(message)(tail), flow(Maybe.some, Future.right))
        )
      )
    }
  }

  function sendMessage(
    channel: PartialTextBasedChannelFields,
    content: StringResolvable,
    options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
  ): Future<Maybe<Message>> {
    return pipe(
      Future.apply(() => channel.send(content, options)),
      Future.map(Maybe.some),
      Future.recover<Maybe<Message>>([
        e => e instanceof DiscordAPIError && e.message === 'Cannot send messages to this user',
        Maybe.none
      ])
    )
  }

  function debugLeft<A>(functionName: string): (f: Future<A>) => Future<A> {
    return Future.mapLeft(e =>
      Error(`${functionName}:\n${(e as any).contructor.name}\n${e.message}`)
    )
  }
}

export namespace DiscordConnector {
  export const futureClient = (config: Config): Future<Client> =>
    Future.apply(
      () =>
        new Promise<Client>(resolve => {
          const client = new Client({
            partials: ['USER', 'CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'REACTION']
          })
          client.on('ready', () => resolve(client))
          client.login(config.clientSecret)
        })
    )
}
