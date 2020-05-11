import { Guild, Role, Message } from 'discord.js'
import { Lens } from 'monocle-ts'

import { DiscordConnector } from './DiscordConnector'
import { PartialLogger } from './Logger'
import { GuildId } from '../models/GuildId'
import { Calls } from '../models/guildState/Calls'
import { GuildState } from '../models/guildState/GuildState'
import { StaticCalls } from '../models/guildState/StaticCalls'
import { TSnowflake } from '../models/TSnowflake'
import { GuildStatePersistence } from '../persistence/GuildStatePersistence'
import { pipe, Maybe, Future, flow, Do, List, IO, NonEmptyArray } from '../utils/fp'
import { LogUtils } from '../utils/LogUtils'
import { StringUtils } from '../utils/StringUtils'

export type GuildStateService = ReturnType<typeof GuildStateService>

export const GuildStateService = (
  Logger: PartialLogger,
  guildStatePersistence: GuildStatePersistence,
  discord: DiscordConnector
) => {
  const logger = Logger('GuildStateService')

  return {
    subscribeCallsMessages: (): Future<void> =>
      pipe(
        guildStatePersistence.findAll(),
        Future.chain(ids =>
          pipe(
            ids,
            List.map(subscribeByGuildId),
            Future.parallel,
            Future.map(_ => {})
          )
        )
      ),

    setCalls: (guild: Guild, calls: Calls): Future<boolean> =>
      set(guild, GuildState.Lens.calls, Maybe.some(StaticCalls.fromCalls(calls))),

    getCalls: (guild: Guild): Future<Maybe<Calls>> =>
      get(
        guild,
        _ => _.calls,
        ({ message, channel, role }) =>
          Do(Future.taskEitherSeq)
            .bind('message', discord.fetchMessage(guild, message))
            .bind('channel', discord.fetchChannel(channel))
            .bind('role', discord.fetchRole(guild, role))
            .return(({ message, channel, role }) =>
              Do(Maybe.option)
                .bind('message', message)
                .bind('channel', channel)
                .bind('role', role)
                .done()
            )
      ),

    setDefaultRole: (guild: Guild, role: Role): Future<boolean> =>
      set(guild, GuildState.Lens.defaultRole, Maybe.some(TSnowflake.wrap(role.id))),

    getDefaultRole: (guild: Guild): Future<Maybe<Role>> =>
      get(
        guild,
        _ => _.defaultRole,
        _ => discord.fetchRole(guild, _)
      )
  }

  function set<A>(guild: Guild, lens: Lens<GuildState, A>, a: A): Future<boolean> {
    const guildId = GuildId.wrap(guild.id)
    return pipe(
      guildStatePersistence.find(guildId),
      Future.map(Maybe.getOrElse(() => GuildState.empty(guildId))),
      Future.map(lens.set(a)),
      Future.chain(_ => guildStatePersistence.upsert(guildId, _))
    )
  }

  function get<A, B>(
    guild: Guild,
    getter: (state: GuildState) => Maybe<A>,
    fetch: (a: A) => Future<Maybe<B>>
  ): Future<Maybe<B>> {
    return pipe(
      guildStatePersistence.find(GuildId.wrap(guild.id)),
      Future.chain(
        flow(
          Maybe.chain(getter),
          Maybe.fold(() => Future.right(Maybe.none), fetch)
        )
      )
    )
  }

  function subscribeByGuildId(guildId: GuildId): Future<void> {
    return pipe(
      discord.resolveGuild(guildId),
      Maybe.fold(
        () => Future.fromIOEither(logger.info(`Guild with id "${guildId}" not found`)),
        guild =>
          pipe(
            messageForGuild(guild),
            Future.chain(
              Maybe.fold(
                () =>
                  pipe(
                    LogUtils.withGuild(logger, 'info', guild)(`No messages to subscribe to`),
                    Future.fromIOEither
                  ),
                subscribeMessages(guild)
              )
            )
          )
      )
    )
  }

  function subscribeMessages(guild: Guild): (messages: Message[]) => Future<void> {
    return messages =>
      pipe(
        List.array.sequence(IO.ioEither)(
          pipe(
            messages,
            List.map(message =>
              pipe(
                LogUtils.withGuild(
                  logger,
                  'info',
                  guild
                )(
                  `Subscribing to message "${message.id}": ${StringUtils.ellipse(97)(
                    message.content
                  )}`
                ),
                IO.chain(_ => discord.subscribeReactions(message))
              )
            )
          )
        ),
        Future.fromIOEither,
        Future.map(_ => {})
      )
  }

  function messageForGuild(guild: Guild): Future<Maybe<NonEmptyArray<Message>>> {
    return pipe(
      guildStatePersistence.find(GuildId.wrap(guild.id)),
      Future.chain(
        Maybe.fold(
          () => Future.right(Maybe.none),
          state =>
            pipe(
              // Maybe<TSnowflake>[]
              [
                pipe(
                  state.calls,
                  Maybe.map(_ => _.message)
                )
                // add other messages to subscribe here
              ],
              List.map(Maybe.fold(() => Future.right(Maybe.none), fetchMessage(guild))),
              Future.parallel,
              Future.map(flow(List.compact, NonEmptyArray.fromArray))
            )
        )
      )
    )
  }

  function fetchMessage(guild: Guild): (messageId: TSnowflake) => Future<Maybe<Message>> {
    return messageId =>
      pipe(
        discord.fetchMessage(guild, messageId),
        Future.chain(res =>
          pipe(
            res,
            Maybe.fold(
              () =>
                pipe(
                  LogUtils.withGuild(
                    logger,
                    'warn',
                    guild
                  )(`Message with id "${messageId}" not found`),
                  Future.fromIOEither,
                  Future.map(_ => res)
                ),
              _ => Future.right(res)
            )
          )
        )
      )
  }
}
