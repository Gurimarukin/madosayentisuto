import { bold, userMention } from '@discordjs/builders'
import type { Guild, GuildAuditLogsEntry, TextChannel } from 'discord.js'
import { User } from 'discord.js'
import { date, io, number, ord, random, semigroup, string } from 'fp-ts'
import type { Ord } from 'fp-ts/Ord'
import { flow, pipe } from 'fp-ts/function'

import { MsDuration } from 'shared/models/MsDuration'
import { Future, IO, List, Maybe, NonEmptyArray } from 'shared/utils/fp'

import { globalConfig } from 'bot/constants'
import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { GuildMemberRemove } from 'bot/models/MadEvent'
import { TSnowflake } from 'bot/models/TSnowflake'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { TObserver } from 'bot/models/rx/TObserver'
import { ChannelUtils } from 'bot/utils/ChannelUtils'
import { LogUtils } from 'bot/utils/LogUtils'

export const NotifyGuildLeaveObserver = (Logger: LoggerGetter): TObserver<GuildMemberRemove> => {
  const logger = Logger('NotifyGuildLeave')

  return {
    next: event => {
      const guild = event.member.guild
      const user = event.member.user
      const log = LogUtils.pretty(logger, guild)
      const boldMember = bold(user.tag)
      return pipe(
        date.now,
        io.map(n => new Date(n)),
        Future.fromIO,
        Future.chain(now => getLastLog(now, guild, TSnowflake.wrap(user.id))),
        Future.map(
          Maybe.fold(
            () =>
              pipe(
                log('info', `${user.tag} left the guild`),
                IO.chain(() => randomMessage(leaveMessages)(boldMember)),
              ),
            ({ action, executor, reason }) =>
              pipe(
                log('info', logMessage(user.tag, executor.tag, action, reason)),
                IO.chain(() =>
                  randomMessage(kickOrBanMessages(action))(boldMember, userMention(executor.id)),
                ),
              ),
          ),
        ),
        Future.chain(Future.fromIOEither),
        sendMessage(event.member.guild),
      )
    },
  }

  function getLastLog(now: Date, guild: Guild, userId: TSnowflake): Future<Maybe<ValidLogsEntry>> {
    return pipe(
      DiscordConnector.fetchAuditLogs(guild),
      Future.map(logs => Maybe.fromNullable(logs.find(isValidLog(now, userId)))),
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
              Future.chain(message => DiscordConnector.sendPrettyMessage(channel, message)),
              Future.map(
                Maybe.fold(
                  () => {}, // TODO: what if message wasn't sent?
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
  (now: Date, userId: TSnowflake) =>
  (entry: GuildAuditLogsEntry): entry is ValidLogsEntry => {
    const nowMinusNetworkTolerance = new Date(
      now.getTime() - MsDuration.unwrap(globalConfig.networkTolerance),
    )
    return (
      ord.leq(date.Ord)(nowMinusNetworkTolerance, entry.createdAt) &&
      List.elem(string.Eq)(entry.action, validActions) &&
      entry.target !== null &&
      entry.target instanceof User &&
      entry.target.id === TSnowflake.unwrap(userId) &&
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

const goodbyeChannel = (guild: Guild): Maybe<TextChannel> =>
  pipe(
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

const logMessage = (
  targetTag: string,
  executorTag: string,
  action: ValidKeys['action'],
  reason: string | null,
): string => {
  const reasonStr = reason !== null ? ` - ${JSON.stringify(reason)}` : ''
  switch (action) {
    case 'MEMBER_KICK':
      return `${targetTag} got kicked by ${executorTag}${reasonStr}`
    case 'MEMBER_BAN_ADD':
      return `${targetTag} got banned by ${executorTag}${reasonStr}`
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
      IO.fromIO,
      IO.map(msg => msg(...args)),
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
