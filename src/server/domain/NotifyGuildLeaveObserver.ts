import type { Collection, Guild, GuildAuditLogsEntry, User } from 'discord.js'
import { AuditLogEvent } from 'discord.js'
import { apply, date, io, number, ord, random, semigroup } from 'fp-ts'
import type { Ord } from 'fp-ts/Ord'
import { flow, pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { MsDuration } from '../../shared/models/MsDuration'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildPositionableChannel, GuildSendableChannel } from '../utils/ChannelUtils'
import { ChannelUtils } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'

const fetchLogsLimit = 30
const networkTolerance = MsDuration.seconds(4)

type KickOrBanAction = AuditLogEvent.MemberKick | AuditLogEvent.MemberBanAdd

type ValidEntry<A extends KickOrBanAction> = {
  action: A
  createdAt: Date
  target: User
  executor: User
  reason: Maybe<string>
}

type CreatedAt = {
  createdAt: Date
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const NotifyGuildLeaveObserver = (Logger: LoggerGetter) => {
  const logger = Logger('NotifyGuildLeaveObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberRemove',
  )(event => {
    const guild = event.member.guild
    const user = event.member.user
    const log = LogUtils.pretty(logger, guild)
    const boldMember = `**${user.tag}**`
    return pipe(
      DayJs.now,
      Future.fromIO,
      Future.chain(getLastLog(guild, DiscordUserId.fromUser(user))),
      futureMaybe.match(
        () =>
          pipe(
            log.info(`${user.tag} left the guild`),
            IO.chainIOK(() => randomMessage(leaveMessages)(boldMember)),
          ),
        ({ action, executor, reason }) =>
          pipe(
            log.info(logMessage(user.tag, executor.tag, action, reason)),
            IO.chainIOK(() =>
              randomMessage(kickOrBanMessages(action))(boldMember, `<@${executor.id}>`),
            ),
          ),
      ),
      Future.chain(Future.fromIOEither),
      sendMessage(event.member.guild),
    )
  })

  function sendMessage(guild: Guild): (futureMessage: Future<string>) => Future<NotUsed> {
    return futureMessage =>
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          channel: futureMaybe.fromOption(goodbyeChannel(guild)),
          message: futureMaybe.fromTaskEither(futureMessage),
        }),
        futureMaybe.chain(({ channel, message }) =>
          DiscordConnector.sendPrettyMessage(channel, message),
        ),
        Future.map(toNotUsed),
      )
  }
}

const getLastLog =
  (guild: Guild, userId: DiscordUserId) =>
  (now: DayJs): Future<Maybe<ValidEntry<KickOrBanAction>>> => {
    const nowMinusNetworkTolerance = pipe(now, DayJs.subtract(networkTolerance))
    const fetchAuditLogsCurry = fetchAuditLogs(guild, userId, nowMinusNetworkTolerance)
    return pipe(
      apply.sequenceS(Future.ApplyPar)({
        lastMemberKick: fetchAuditLogsCurry(AuditLogEvent.MemberKick),
        lastMemberBan: fetchAuditLogsCurry(AuditLogEvent.MemberBanAdd),
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

const fetchAuditLogs =
  (guild: Guild, userId: DiscordUserId, nowMinusNetworkTolerance: DayJs) =>
  <A extends KickOrBanAction>(type: A): Future<Maybe<ValidEntry<A>>> =>
    pipe(
      DiscordConnector.fetchAuditLogs(guild, { type, limit: fetchLogsLimit }),
      futureMaybe.chainOptionK(validateLogs(nowMinusNetworkTolerance, userId)),
    )

const ordByCreateAt = <A extends CreatedAt>(): Ord<A> =>
  pipe(
    date.Ord,
    ord.contramap(a => a.createdAt),
  )
const validateLogs =
  (nowMinusNetworkTolerance: DayJs, userId: DiscordUserId) =>
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
  <A extends KickOrBanAction>(nowMinusNetworkTolerance: DayJs, userId: DiscordUserId) =>
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
          ord.leq(DayJs.Ord)(nowMinusNetworkTolerance, DayJs.of(entry.createdAt)) &&
          DiscordUserId.fromUser(target) === userId,
      ),
    )

const minimum: <A>(ord_: Ord<A>) => (nea: NonEmptyArray<A>) => A = flow(
  semigroup.min,
  NonEmptyArray.concatAll,
)

const channelPositionOrd = ord.contramap((c: GuildPositionableChannel) => c.position)(number.Ord)

const goodbyeChannel = (guild: Guild): Maybe<GuildSendableChannel> =>
  pipe(
    Maybe.fromNullable(guild.systemChannel),
    Maybe.alt(() =>
      pipe(
        guild.channels.cache.toJSON(),
        List.filter(ChannelUtils.isGuildPositionable),
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
    case AuditLogEvent.MemberKick:
      return `${targetTag} got kicked by ${executorTag}${reasonStr}`
    case AuditLogEvent.MemberBanAdd:
      return `${targetTag} got banned by ${executorTag}${reasonStr}`
  }
}

type MessageGetter<A extends [...args: List<unknown>]> = (...args: A) => string

const randomMessage =
  <A extends [...args: List<unknown>]>(nea: NonEmptyArray<MessageGetter<A>>) =>
  (...args: A): io.IO<string> =>
    pipe(
      random.randomElem(nea),
      io.map(msg => msg(...args)),
    )

const leaveMessages: NonEmptyArray<MessageGetter<[member: string]>> = [
  m => `${m} se barre, parce qu'iel en avait marre (de vous).`,
  m => `Gibier de potence, ${m} quitte le navire...`,
  m => `La trahison de ${m} est comme le sel sur une plaie.`,
  m => `${m} me tourne le dos et invite mon poignard.`,
  m => `J'ai perdu ${m}, mais pas mon âme.`,
  m => `Ne jamais faire confiance à ${m}.`,
  m => `Je vais emmener ${m} aux quais-abattoirs...`,
]

type KickOrBanMessageGetters = NonEmptyArray<MessageGetter<[member: string, admin: string]>>

const kickOrBanMessages = (action: KickOrBanAction): KickOrBanMessageGetters => {
  switch (action) {
    case AuditLogEvent.MemberKick:
      return [
        // (m, a) => `${m} left the guild; kicked by ${a}.`,
        (m, a) => `${m} s'en est allé, mis à la porte par ${a}.`,
      ]
    case AuditLogEvent.MemberBanAdd:
      return [
        // (m, a) => `${m} got hit with the swift hammer of justice, wielded by the mighty ${a}.`,
        (m, a) => `Le marteau de la justice, brandi par ${a}, a frappé ${m}.`,
      ]
  }
}
