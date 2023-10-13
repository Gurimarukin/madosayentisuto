import type { Guild, GuildMember } from 'discord.js'
import { string } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { GuildId } from '../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector, isMissingPermissionsError } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'
import { DebugError } from '../utils/debugLeft'
import { formatNickname } from '../utils/formatNickname'

type UwURenamerObserver = ReturnType<typeof UwURenamerObserver>

const UwURenamerObserver = (
  Logger: LoggerGetter,
  clientId: DiscordUserId,
  uwuGuilds: List<GuildId>,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('UwURenamerObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberAdd',
  )(event => {
    switch (event.type) {
      case 'GuildMemberAdd':
        return onGuildMemberAdd(event.member)
    }
  })

  function onGuildMemberAdd(member: GuildMember): Future<NotUsed> {
    if (DiscordUserId.fromUser(member.user) === clientId || !isUwUGuild(member.guild)) {
      return Future.notUsed
    }

    const log = LogUtils.pretty(logger, member.guild)
    return pipe(
      uwuRename(member.user.username),
      Maybe.fold(
        () => Future.fromIOEither(log.info(`No need to rename ${member.user.tag} on guild join`)),
        newNickname =>
          pipe(
            memberSetNickname(member, Maybe.some(newNickname)),
            futureMaybe.chainFirstIOEitherK(newMember =>
              log.info(
                `Renamed ${member.user.tag} to ${formatNickname(newMember.nickname)} on guild join`,
              ),
            ),
            Future.map(toNotUsed),
          ),
      ),
    )
  }

  /**
   * @returns none if missing permissions
   */
  function memberSetNickname(
    member: GuildMember,
    nickname: Maybe<string>,
  ): Future<Maybe<GuildMember>> {
    return pipe(
      DiscordConnector.memberSetNickname(member, nickname),
      Future.map(Maybe.some),
      Future.orElse(e =>
        e instanceof DebugError && isMissingPermissionsError(e.originalError)
          ? pipe(
              LogUtils.pretty(logger, member.guild).warn(
                `Couldn't rename ${member.user.tag} from ${formatNickname(
                  member.nickname,
                )} to ${formatNickname(nickname)}: missing permissions`,
              ),
              Future.fromIOEither,
              Future.map(() => Maybe.none),
            )
          : Future.failed(e),
      ),
    )
  }

  function isUwUGuild(guild: Guild): boolean {
    return pipe(
      uwuGuilds,
      List.exists(guildId => guildId === GuildId.fromGuild(guild)),
    )
  }
}

const uwuOrOwORegex = /(uwu|owo)/i

export const isValidUwU = (nickname: string): boolean =>
  uwuOrOwORegex.test(StringUtils.cleanUTF8ToASCII(nickname))

// none: no rename needed
export const uwuRename = (username: string): Maybe<string> => {
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
