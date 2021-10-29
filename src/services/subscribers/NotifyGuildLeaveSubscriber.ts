import { bold, userMention } from '@discordjs/builders'
import { Guild, GuildAuditLogsEntry, GuildMember, TextChannel, User } from 'discord.js'
import { date, io, number, ord, random, semigroup, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { Ord } from 'fp-ts/Ord'

import { globalConfig } from '../../globalConfig'
import { MadEvent } from '../../models/MadEvent'
import { MsDuration } from '../../models/MsDuration'
import { Subscriber } from '../../models/Subscriber'
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
          date.now,
          io.map(n => ({ now: new Date(n) })),
          Future.fromIO,
          Future.bind('member', () => discord.fetchPartial(event.member)),
          Future.bind('log', ({ now, member }) => getLastLog(now, member)),
          Future.chain(({ log, member }) => {
            const logWithGuild = LogUtils.withGuild(logger, 'info', member.guild)
            const boldMember = bold(member.user.tag)
            return pipe(
              log,
              Maybe.fold(
                () =>
                  pipe(
                    logWithGuild(`${member.user.tag} left the server`),
                    IO.chain(() => randomMessage(leaveMessages)(boldMember)),
                  ),
                ({ action, executor }) =>
                  pipe(
                    logWithGuild(logMessage(member.user.tag, executor.tag, action)),
                    IO.chain(() =>
                      randomMessage(kickOrBanMessages(action))(
                        boldMember,
                        userMention(executor.id),
                      ),
                    ),
                  ),
              ),
              Future.fromIOEither,
            )
          }),
          sendMessage(event.member.guild),
          IO.runFuture,
        )
      }

      return IO.unit
    },
  }

  function getLastLog(now: Date, member: GuildMember): Future<Maybe<ValidLogsEntry>> {
    return pipe(
      discord.fetchAuditLogs(member.guild),
      Future.map(logs => Maybe.fromNullable(logs.find(isValidLog(now)))),
    )
  }

  function sendMessage(guild: Guild): (futureMessage: Future<string>) => Future<void> {
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
      )
  }
}

const validActions: List<ValidKeys['action']> = ['MEMBER_KICK', 'MEMBER_BAN_ADD']
const isValidLog =
  (now: Date) =>
  (entry: GuildAuditLogsEntry): entry is ValidLogsEntry => {
    const nowMinusNetworkTolerance = new Date(
      now.getTime() - MsDuration.unwrap(globalConfig.networkTolerance),
    )
    return (
      ord.leq(date.Ord)(nowMinusNetworkTolerance, entry.createdAt) &&
      List.elem(string.Eq)(entry.action, validActions) &&
      entry.target !== null &&
      entry.target instanceof User &&
      entry.executor !== null &&
      entry.executor instanceof User
    )
  }

type ValidKeys = {
  readonly createdAt: Date
  readonly action: 'MEMBER_KICK' | 'MEMBER_BAN_ADD'
  readonly target: User
  readonly executor: User
}
type ValidLogsEntry = Omit<GuildAuditLogsEntry, keyof ValidKeys> & ValidKeys

const minimum: <A>(ord_: Ord<A>) => (nea: NonEmptyArray<A>) => A = flow(
  semigroup.min,
  NonEmptyArray.concatAll,
)

const channelPositionOrd = ord.contramap((c: TextChannel) => c.position)(number.Ord)

function goodbyeChannel(guild: Guild): Maybe<TextChannel> {
  return pipe(
    Maybe.fromNullable(guild.systemChannel),
    Maybe.alt(() =>
      pipe(
        guild.channels.cache.toJSON(),
        List.filter(ChannelUtils.isTextChannel),
        NonEmptyArray.fromReadonlyArray,
        Maybe.map(minimum(channelPositionOrd)),
      ),
    ),
  )
}

const logMessage = (
  targetTag: string,
  executorTag: string,
  action: ValidKeys['action'],
): string => {
  switch (action) {
    case 'MEMBER_KICK':
      return `${targetTag} got kicked by ${executorTag}`
    case 'MEMBER_BAN_ADD':
      return `${targetTag} got banned by ${executorTag}`
  }
}

const kickOrBanMessages = (action: ValidKeys['action']): KickOrBanMessageGetters => {
  switch (action) {
    case 'MEMBER_KICK':
      return kickMessages
    case 'MEMBER_BAN_ADD':
      return banMessages
  }
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

type KickOrBanMessageGetters = NonEmptyArray<
  MessageGetter<readonly [member: string, admin: string]>
>

const kickMessages: KickOrBanMessageGetters = [
  // (m, a) => `${m} left the guild; kicked by ${a}.`,
  (m, a) => `${m} s'en est allé, mis à la porte par ${a}.`,
]

const banMessages: KickOrBanMessageGetters = [
  // (m, a) => `${m} got hit with the swift hammer of justice, wielded by the mighty ${a}.`,
  (m, a) => `Le marteau de la justice, brandi par ${a}, a frappé ${m}.`,
]
