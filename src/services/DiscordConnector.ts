import * as Obs from 'fp-ts-rxjs/lib/ObservableEither'
import {
  Client,
  Message,
  PartialTextBasedChannelFields,
  StringResolvable,
  MessageOptions,
  MessageAdditions,
  Channel,
  User,
  DiscordAPIError,
  Presence,
  ActivityOptions,
  PartialGuildMember,
  GuildMember
} from 'discord.js'
import { fromEventPattern } from 'rxjs'

import { ObservableE } from '../models/ObservableE'
import { TSnowflake } from '../models/TSnowflake'
import { VoiceStateUpdate } from '../models/VoiceStateUpdate'
import { Maybe, pipe, Future, Task, Either } from '../utils/fp'
import { GuildMemberEvent } from '../models/GuildMemberEvent'

export type DiscordConnector = ReturnType<typeof DiscordConnector>

export const DiscordConnector = (client: Client) => {
  return {
    isFromSelf: (message: Message): boolean =>
      pipe(
        Maybe.fromNullable(client.user),
        Maybe.exists(_ => _.id === message.author.id)
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

    guildMemberEvents: (): ObservableE<GuildMemberEvent> =>
      pipe(
        fromEventPattern<GuildMemberEvent>(handler => {
          client.on('guildMemberAdd', member =>
            pipe(
              fullMember(member),
              Future.map(_ => handler(GuildMemberEvent.Add(_))),
              Future.runUnsafe
            )
          )
          client.on('guildMemberRemove', member =>
            pipe(
              fullMember(member),
              Future.map(_ => handler(GuildMemberEvent.Remove(_))),
              Future.runUnsafe
            )
          )
        }),
        Obs.rightObservable
      ),

    /**
     * Read
     */
    fetchChannel: (channel: TSnowflake): Future<Maybe<Channel>> =>
      pipe(
        Future.apply(() => client.channels.fetch(TSnowflake.unwrap(channel))),
        Task.map(_ => pipe(_, Maybe.fromEither, Either.right))
      ),

    fetchUser: (user: TSnowflake): Future<Maybe<User>> =>
      pipe(
        Future.apply(() => client.users.fetch(TSnowflake.unwrap(user))),
        Task.map(_ => pipe(_, Maybe.fromEither, Either.right))
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

    sendMessage: (
      channel: PartialTextBasedChannelFields,
      content: StringResolvable,
      options?: MessageOptions | (MessageOptions & { split?: false }) | MessageAdditions
    ): Future<Message> => Future.apply(() => channel.send(content, options)),

    deleteMessage: (message: Message): Future<boolean> =>
      pipe(
        Future.apply(() => message.delete()),
        Task.map(
          Either.fold(
            e =>
              e instanceof DiscordAPIError && e.message === 'Missing Permissions'
                ? Either.right(false)
                : Either.left(e),
            _ => Either.right(true)
          )
        )
      )
  }

  function fullMember(member: GuildMember | PartialGuildMember): Future<GuildMember> {
    return member.partial ? Future.apply(() => member.fetch()) : Future.right(member)
  }
}
