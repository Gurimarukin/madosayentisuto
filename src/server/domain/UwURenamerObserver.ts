import type {
  GuildAuditLogsEntry,
  GuildAuditLogsResolvable,
  GuildMember,
  PartialGuildMember,
  User,
} from 'discord.js'
import { AuditLogEvent } from 'discord.js'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, Maybe, NonEmptyArray } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { GuildHelper } from '../helpers/GuildHelper'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'

type UwURenamerObserver = ReturnType<typeof UwURenamerObserver>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const UwURenamerObserver = (Logger: LoggerGetter, clientId: DiscordUserId) => {
  const logger = Logger('UwURenamerObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberUpdate',
  )(event => {
    switch (event.type) {
      case 'GuildMemberUpdate':
        return onGuildMemberUpdate(event.oldMember, event.newMember)
    }
  })

  function onGuildMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Future<NotUsed> {
    if (DiscordUserId.fromUser(newMember.user) === clientId) return Future.notUsed // do nothing if bot was updated

    if (oldMember.nickname !== newMember.nickname) return onNicknameUpdated(oldMember, newMember)

    return Future.notUsed
  }

  function onNicknameUpdated(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Future<NotUsed> {
    const wasRenamedMessage = `${newMember.user.tag} renamed from ${oldMember.nickname} to ${newMember.nickname}`

    return pipe(
      GuildHelper.fetchLastAuditLog(newMember.guild, { type: AuditLogEvent.MemberUpdate }),
      Future.chain(
        Maybe.fold(
          () => Future.left(Error(`No AuditLogsEntry was found (${wasRenamedMessage})`)),
          Future.right,
        ),
      ),
      Future.filterOrElse(entryIsDefined, () => Error(`executor was null (${wasRenamedMessage})`)),
      Future.chain(entry => {
        const log = LogUtils.pretty(logger, newMember.guild)
        const wasRenamedByMessage = `${wasRenamedMessage} by ${entry.executor.tag}`

        if (DiscordUserId.fromUser(entry.executor) === clientId) {
          return Future.fromIOEither(log.info(wasRenamedByMessage))
        }

        // null    > UwU
        // not UwU > UwU
        // UwU     > UwU
        if (isValidUwU(newMember.displayName)) {
          return Future.fromIOEither(log.debug(wasRenamedByMessage))
        }

        // null    > not UwU
        // not UwU > not UwU
        // UwU     > not UwU
        return pipe(
          DiscordConnector.memberSetNickname(newMember, Maybe.fromNullable(oldMember.nickname)),
          Future.chainIOEitherK(() =>
            isValidUwU(oldMember.displayName)
              ? log.debug(wasRenamedByMessage)
              : log.warn(`${wasRenamedByMessage} but it's not a valid UwU`),
          ),
        )
      }),
    )
  }
}

type DefinedGuildAuditLogsEntry<A extends GuildAuditLogsResolvable = null> = Omit<
  GuildAuditLogsEntry<A>,
  'executor'
> & {
  readonly executor: User
}

const entryIsDefined = <A extends GuildAuditLogsResolvable = null>(
  entry: GuildAuditLogsEntry<A>,
): entry is DefinedGuildAuditLogsEntry<A> => entry.executor !== null

const uwuOrOwORegex = /(uwu|owo)/i

export const isValidUwU = (nickname: string): boolean =>
  uwuOrOwORegex.test(StringUtils.cleanUTF8ToASCII(nickname))

// none: no rename needed
export const renameUwU = (username: string): Maybe<string> => {
  if (isValidUwU(username)) return Maybe.none
  const reversed = StringUtils.reverse(username)
  return pipe(
    renamersReversed,
    List.findFirstMap(rename => pipe(rename(reversed), Maybe.fromPredicate(isValidUwU))),
    Maybe.map(StringUtils.reverse),
    Maybe.getOrElse(() =>
      pipe(renamersNormal, NonEmptyArray.unappend, ([initRenamers, lastRenamer]) =>
        pipe(
          initRenamers,
          List.findFirstMap(rename => pipe(rename(username), Maybe.fromPredicate(isValidUwU))),
          Maybe.getOrElse(() => lastRenamer(username)),
        ),
      ),
    ),
    Maybe.some,
  )
}

const spaceRegex = /\s/

const renamersReversed: NonEmptyArray<(username: string) => string> = [
  string.replace('U', 'UwU'),
  string.replace('u', 'UwU'),
  string.replace('O', 'OwO'),
  string.replace('Y', 'UwU'), // y close enough to u
  string.replace('y', 'UwUy'), // UwUy becomes yUwU after reverse
  string.replace('o', 'OwO'),
  string.replace('w', 'UwU'),
  string.replace('0', 'OwO'),
]

const renamersNormal: NonEmptyArray<(username: string) => string> = [
  // if nothing interesting in username, just append it
  string.replace(/[aeiouy]$/i, 'UwU'), // squish ending vowel
  s => (spaceRegex.test(s) ? `${s} UwU` : `${s}UwU`),
]

export { UwURenamerObserver }
