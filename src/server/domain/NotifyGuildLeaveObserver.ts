import { bold, userMention } from '@discordjs/builders'
import type { Collection, Guild, GuildAuditLogsEntry, TextChannel } from 'discord.js'
import type { User } from 'discord.js'
import { apply, date, number, ord, random, semigroup } from 'fp-ts'
import type { Ord } from 'fp-ts/Ord'
import { flow, pipe } from 'fp-ts/function'

import { UserId } from '../../shared/models/guild/UserId'
import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { Future, IO, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventGuildMemberRemove } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import { ChannelUtils } from '../utils/ChannelUtils'
import { DateUtils } from '../utils/DateUtils'
import { LogUtils } from '../utils/LogUtils'

type KickOrBanAction = 'MEMBER_KICK' | 'MEMBER_BAN_ADD'

type ValidEntry<A extends KickOrBanAction> = {
  readonly action: A
  readonly createdAt: Date
  readonly target: User
  readonly executor: User
  readonly reason: Maybe<string>
}

type CreatedAt = {
  readonly createdAt: Date
}

export const NotifyGuildLeaveObserver = (
  Logger: LoggerGetter,
): TObserver<MadEventGuildMemberRemove> => {
  const logger = Logger('NotifyGuildLeave')

  return {
    next: event => {
      const guild = event.member.guild
      const user = event.member.user
      const log = LogUtils.pretty(logger, guild)
      const boldMember = bold(user.tag)
      return pipe(
        date.create,
        Future.fromIO,
        Future.chain(getLastLog(guild, UserId.wrap(user.id))),
        futureMaybe.match(
          () =>
            pipe(
              log.info(`${user.tag} left the guild`),
              IO.chain(() => randomMessage(leaveMessages)(boldMember)),
            ),
          ({ action, executor, reason }) =>
            pipe(
              log.info(logMessage(user.tag, executor.tag, action, reason)),
              IO.chain(() =>
                randomMessage(kickOrBanMessages[action])(boldMember, userMention(executor.id)),
              ),
            ),
        ),
        Future.chain(Future.fromIOEither),
        sendMessage(event.member.guild),
      )
    },
  }

  function sendMessage(guild: Guild): (futureMessage: Future<string>) => Future<void> {
    return futureMessage =>
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          channel: futureMaybe.fromOption(goodbyeChannel(guild)),
          message: futureMaybe.fromFuture(futureMessage),
        }),
        futureMaybe.chain(({ channel, message }) =>
          DiscordConnector.sendPrettyMessage(channel, message),
        ),
        Future.map(() => {}),
      )
  }
}

const getLastLog =
  (guild: Guild, userId: UserId) =>
  (now: Date): Future<Maybe<ValidEntry<KickOrBanAction>>> => {
    const nowMinusNetworkTolerance = pipe(now, DateUtils.minusDuration(constants.networkTolerance))
    return pipe(
      apply.sequenceS(Future.ApplyPar)({
        lastMemberKick: pipe(
          DiscordConnector.fetchAuditLogs(guild, { type: 'MEMBER_KICK' }),
          futureMaybe.chainOption(validateLogs(nowMinusNetworkTolerance, userId)),
        ),
        lastMemberBan: pipe(
          DiscordConnector.fetchAuditLogs(guild, { type: 'MEMBER_BAN_ADD' }),
          futureMaybe.chainOption(validateLogs(nowMinusNetworkTolerance, userId)),
        ),
      }),
      Future.map(({ lastMemberKick, lastMemberBan }) =>
        Maybe.isSome(lastMemberKick) && Maybe.isSome(lastMemberBan)
          ? Maybe.some(
              ord.max(ordByCreateAt<ValidEntry<KickOrBanAction>>())(
                lastMemberKick.value,
                lastMemberBan.value,
              ),
            )
          : pipe(
              lastMemberKick,
              Maybe.altW(() => lastMemberBan),
            ),
      ),
    )
  }

const ordByCreateAt = <A extends CreatedAt>(): Ord<A> =>
  pipe(
    date.Ord,
    ord.contramap(a => a.createdAt),
  )
const validateLogs =
  (nowMinusNetworkTolerance: Date, userId: UserId) =>
  <A extends KickOrBanAction>(
    logs: Collection<string, GuildAuditLogsEntry<A>>,
  ): Maybe<ValidEntry<A>> =>
    pipe(
      logs.toJSON(),
      NonEmptyArray.fromArray,
      Maybe.map(NonEmptyArray.max(ordByCreateAt<GuildAuditLogsEntry<A>>())),
      Maybe.chain(validateEntry(nowMinusNetworkTolerance, userId)),
    )

const validateEntry =
  <A extends KickOrBanAction>(nowMinusNetworkTolerance: Date, userId: UserId) =>
  (entry: GuildAuditLogsEntry<A>): Maybe<ValidEntry<A>> =>
    pipe(
      Maybe.some({
        action: entry.action as A,
        createdAt: entry.createdAt,
        reason: Maybe.fromNullable(entry.reason),
      }),
      Maybe.apS('target', Maybe.fromNullable(entry.target)),
      Maybe.apS('executor', Maybe.fromNullable(entry.executor)),
      Maybe.filter(
        ({ target }) =>
          ord.leq(date.Ord)(nowMinusNetworkTolerance, entry.createdAt) &&
          UserId.wrap(target.id) === userId,
      ),
    )

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
  action: KickOrBanAction,
  reason: Maybe<string>,
): string => {
  const reasonStr = pipe(
    reason,
    Maybe.fold(
      () => '',
      r => ` - ${JSON.stringify(r)}`,
    ),
  )
  switch (action) {
    case 'MEMBER_KICK':
      return `${targetTag} got kicked by ${executorTag}${reasonStr}`
    case 'MEMBER_BAN_ADD':
      return `${targetTag} got banned by ${executorTag}${reasonStr}`
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

const kickOrBanMessages: Record<KickOrBanAction, KickOrBanMessageGetters> = {
  MEMBER_KICK: [
    // (m, a) => `${m} left the guild; kicked by ${a}.`,
    (m, a) => `${m} s'en est allé, mis à la porte par ${a}.`,
  ],
  MEMBER_BAN_ADD: [
    // (m, a) => `${m} got hit with the swift hammer of justice, wielded by the mighty ${a}.`,
    (m, a) => `Le marteau de la justice, brandi par ${a}, a frappé ${m}.`,
  ],
}
