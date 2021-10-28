import { bold } from '@discordjs/builders'
import { Guild, GuildAuditLogsEntry, TextChannel, User } from 'discord.js'
import { apply, io, number, ord, random } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MadEvent } from '../../models/MadEvent'
import { Subscriber } from '../../models/Subscriber'
import { TSnowflake } from '../../models/TSnowflake'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { Either, Future, IO, List, Maybe, NonEmptyArray } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { DiscordConnector } from '../DiscordConnector'
import { PartialLogger } from '../Logger'

export const NotifyGuildLeaveSubscriber = (
  Logger: PartialLogger,
  discord: DiscordConnector,
): Subscriber<MadEvent> => {
  const logger = Logger('NotifyGuildLeave')

  return {
    next: event => {
      if (event.type === 'GuildMemberRemove') {
        return pipe(
          apply.sequenceS(Future.ApplyPar)({
            kickLog: discord.fetchLastAuditLogs(event.member.guild, { type: 'MEMBER_KICK' }),
            member: discord.fetchPartial(event.member),
          }),
          Future.chain(({ kickLog, member }) => {
            const logWithGuild = LogUtils.withGuild(logger, 'info', member.guild)
            const boldMember = bold(member.user.tag)
            return pipe(
              kickLog,
              Maybe.chain(validateLog(TSnowflake.wrap(member.id))),
              Maybe.fold(
                () =>
                  pipe(
                    logWithGuild(`${member.user.tag} left the server`),
                    IO.chain(() => randomMessage(leaveMessages)(boldMember)),
                  ),
                ({ executor }) =>
                  pipe(
                    logWithGuild(
                      `${member.user.tag} got kicked from the server by ${executor.tag}`,
                    ),
                    IO.chain(() => randomMessage(kickMessages)(boldMember, bold(executor.tag))),
                  ),
              ),
              Future.fromIOEither,
            )
          }),
          sendMessage(event.member.guild),
        )
      }

      // if (event.type === 'GuildBanAdd') {
      //   const ban = event.ban
      //   return pipe(
      //     discord.fetchLastAuditLogs(ban.guild, { type: 'MEMBER_BAN_ADD' }),
      //     Future.map(Maybe.chain(validateLog(TSnowflake.wrap(ban.user.id)))),
      //     Future.chain(maybeLog =>
      //       pipe(
      //         LogUtils.withGuild(
      //           logger,
      //           'info',
      //           ban.guild,
      //         )(
      //           `${ban.user.tag} got banned${
      //             Maybe.isSome(maybeLog) ? ` by ${maybeLog.value.executor.tag}` : ''
      //           }`,
      //         ),
      //         IO.chain(() =>
      //           randomMessage(banMessages)(
      //             bold(ban.user.tag),
      //             pipe(
      //               maybeLog,
      //               Maybe.map(({ executor }) => bold(executor.tag)),
      //             ),
      //           ),
      //         ),
      //         Future.fromIOEither,
      //       ),
      //     ),
      //     sendMessage(ban.guild),
      //   )
      // }

      return IO.unit
    },
  }

  function sendMessage(guild: Guild): (futureMessage: Future<string>) => IO<void> {
    return futureMessage =>
      pipe(
        goodbyeChannel(guild),
        Maybe.fold(
          () => Future.unit, // TODO: what if no goodbyeChannel?
          channel =>
            pipe(
              futureMessage,
              Future.chain(message => discord.sendPrettyMessage(channel, message)),
              Future.map(
                Maybe.fold(
                  () => {}, // TODO: what is message wasn't sent?
                  () => {},
                ),
              ),
            ),
        ),
        IO.runFuture,
      )
  }
}

type ValidatedLog = {
  readonly target: User
  readonly executor: User
}

const validateLog =
  (memberId: TSnowflake) =>
  (log: GuildAuditLogsEntry): Maybe<ValidatedLog> =>
    pipe(
      Maybe.Do,
      Maybe.bind('target', () => pipe(Maybe.fromNullable(log.target), Maybe.filter(isUser))),
      Maybe.bind('executor', () => Maybe.fromNullable(log.executor)),
      Maybe.filter(({ target }) => TSnowflake.wrap(target.id) === memberId),
    )

const isUser = (t: NonNullable<GuildAuditLogsEntry['target']>): t is User => t instanceof User

const ordChannel = ord.contramap((c: TextChannel) => c.position)(number.Ord)

function goodbyeChannel(guild: Guild): Maybe<TextChannel> {
  return pipe(
    Maybe.fromNullable(guild.systemChannel),
    Maybe.alt(() =>
      pipe(
        guild.channels.cache.toJSON(),
        List.filter(ChannelUtils.isTextChannel),
        List.sort(ordChannel),
        List.head,
      ),
    ),
  )
}

type MessageGetter<A extends readonly [...args: ReadonlyArray<unknown>]> = (...args: A) => string

const randomMessage =
  <A extends readonly [...args: ReadonlyArray<unknown>]>(nea: NonEmptyArray<MessageGetter<A>>) =>
  (...args: A): IO<string> =>
    pipe(
      random.randomElem(nea),
      io.map(msg => Either.right(msg(...args))),
    )

const leaveMessages: NonEmptyArray<MessageGetter<readonly [member: string]>> = [
  m => `${m} se barre, parce qu'al en avait marre (de vous).`,
  m => `Gibier de potence, ${m} quitte le navire...`,
  m => `La trahison de ${m} est comme le sel sur une plaie.`,
  m => `${m} me tourne le dos et invite mon poignard.`,
  m => `J'ai perdu ${m}, mais pas mon âme.`,
  m => `Ne jamais faire confiance à ${m}.`,
  m => `Je vais emmener ${m} aux quais-abattoirs...`,
]

const kickMessages: NonEmptyArray<MessageGetter<readonly [member: string, admin: string]>> = [
  // (m, a) => `${m} left the guild; kicked by ${a}.`,
  (m, a) => `${m} s'en est allé, mis à la porte par ${a}.`,
]

// const banMessages: NonEmptyArray<MessageGetter<readonly [member: string, admin: Maybe<string>]>> = [
//   // (m, a) =>
//   //   `${m} got hit with the swift hammer of justice${
//   //     Maybe.isSome(a) ? `, wielded by the mighty ${a.value}` : ''
//   //   }.`,
//   (m, a) =>
//     `Le prompt marteau de la justice ${
//       Maybe.isSome(a) ? `, brandi par l'impitoyable' ${a.value},` : ''
//     } a frappé ${m}.`,
//   (m, a) =>
//     `Le prompt marteau de la justice ${
//       Maybe.isSome(a) ? `, brandi par l'énergique ${a.value},` : ''
//     } a frappé ${m}.`,
//   (m, a) =>
//     `Le prompt marteau de la justice ${
//       Maybe.isSome(a) ? `, brandi par l'efficace ${a.value},` : ''
//     } a frappé ${m}.`,
// ]
