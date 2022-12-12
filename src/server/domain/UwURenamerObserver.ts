import type {
  AuditLogChange,
  Guild,
  GuildAuditLogsEntry,
  GuildMember,
  Message,
  PartialGuildMember,
  User,
} from 'discord.js'
import { AuditLogEvent } from 'discord.js'
import { apply, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ValidatedNea } from '../../shared/models/ValidatedNea'
import { GuildId } from '../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { DiscordUtils } from '../../shared/utils/DiscordUtils'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Either, Future, List, Maybe, NonEmptyArray, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../config/constants'
import { DiscordConnector, isMissingPermissionsError } from '../helpers/DiscordConnector'
import { GuildHelper } from '../helpers/GuildHelper'
import { MessageComponent } from '../models/discord/MessageComponent'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { LogUtils } from '../utils/LogUtils'
import { DebugError } from '../utils/debugLeft'

type UwURenamerObserver = ReturnType<typeof UwURenamerObserver>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const UwURenamerObserver = (
  Logger: LoggerGetter,
  clientId: DiscordUserId,
  uwuServer: List<GuildId>,
) => {
  const logger = Logger('UwURenamerObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberAdd',
    'GuildMemberUpdate',
  )(event => {
    switch (event.type) {
      case 'GuildMemberAdd':
        return onGuildMemberAdd(event.member)
      case 'GuildMemberUpdate':
        return onGuildMemberUpdate(event.oldMember, event.newMember)
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
                `Renamed ${member.user.tag} to ${formatNickname(
                  Maybe.fromNullable(newMember.nickname),
                )} on guild join`,
              ),
            ),
            futureMaybe.chain(
              (
                newMember,
              ): Future<Maybe<Message<false>>> => // TODO: remove explicit return type when upgrading TypeScript
                pipe(
                  sendRenamedDM(newMember, renamedOnJoinMessage(newMember)),
                  Future.delay(constants.guildJoinRenamedDelay),
                ),
            ),
            Future.map(toNotUsed),
          ),
      ),
    )
  }

  function onGuildMemberUpdate(
    oldMember: GuildMember | PartialGuildMember,
    newMember: GuildMember,
  ): Future<NotUsed> {
    if (DiscordUserId.fromUser(newMember.user) === clientId) return Future.notUsed // do nothing if bot was updated

    if (oldMember.nickname !== newMember.nickname) {
      // oldMember is not reliable for previous nickname, we have to use guild's audit logs
      // (audit logs also gives us executor)
      return onNicknameUpdated(newMember)
    }

    return Future.notUsed
  }

  function onNicknameUpdated(renamedMember: GuildMember): Future<NotUsed> {
    const guild = renamedMember.guild
    return pipe(
      GuildHelper.fetchLastAuditLog(guild, { type: AuditLogEvent.MemberUpdate }),
      futureMaybe.getOrElse(() =>
        Future.left(
          Error(
            `onNicknameUpdated: No GuildAuditLogsEntry<MemberUpdate> was found for ${guild.name}`,
          ),
        ),
      ),
      Future.chainEitherK(
        flow(
          validateMemberRename,
          Either.mapLeft(nea =>
            Error(
              `Invalid MemberRename:${
                nea.length === 1
                  ? ` ${NonEmptyArray.head(nea)}`
                  : pipe(nea, List.mkString('\n- ', '\n- ', ''))
              }`,
            ),
          ),
        ),
      ),
      Future.chain(({ executor, oldNickname, newNickname }) => {
        const log = LogUtils.pretty(logger, guild)
        const wasRenamedMessage = `${renamedMember.user.tag} was renamed from ${formatNickname(
          oldNickname,
        )} to ${formatNickname(newNickname)} by ${executor.tag}`

        if (!isUwUGuild(guild)) {
          // just log and don't do anything else (even if bot was renamed)
          return Future.fromIOEither(log.debug(wasRenamedMessage))
        }

        if (DiscordUserId.fromUser(executor) === clientId) {
          // don't log (should have been logged when setNickname was called)
          return Future.notUsed
        }

        if (isValidUwU(getDisplayName(renamedMember.user, newNickname))) {
          // null    > UwU
          // not UwU > UwU
          // UwU     > UwU

          // no rename needed, just log
          return Future.fromIOEither(log.debug(wasRenamedMessage))
        }

        // null    > not UwU
        // not UwU > not UwU
        // UwU     > not UwU

        // we have to rename it back
        // warn if renaming to invalid UwU
        return pipe(
          log.debug(wasRenamedMessage),
          Future.fromIOEither,
          Future.chain(() => memberSetNickname(renamedMember, oldNickname)),
          futureMaybe.chainFirstIOEitherK(() => {
            const wasRenamedBackMessage = `Renamed ${
              renamedMember.user.tag
            } back to ${formatNickname(oldNickname)} after invalid UwU rename`
            return isValidUwU(getDisplayName(renamedMember.user, oldNickname))
              ? log.info(wasRenamedBackMessage)
              : log.warn(`${wasRenamedBackMessage}, but it's also not a valid UwU`)
          }),
          futureMaybe.chain(newMember =>
            sendRenamedDM(newMember, renamedBackMessage(newMember, newNickname)),
          ),
          Future.map(toNotUsed),
        )
      }),
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
                  Maybe.fromNullable(member.nickname),
                )} to ${formatNickname(nickname)}: missing permissions`,
              ),
              Future.fromIOEither,
              Future.map(() => Maybe.none),
            )
          : Future.left(e),
      ),
    )
  }

  function isUwUGuild(guild: Guild): boolean {
    return pipe(
      uwuServer,
      List.exists(guildId => guildId === GuildId.fromGuild(guild)),
    )
  }
}

type MemberRename = {
  readonly executor: User
  readonly oldNickname: Maybe<string>
  readonly newNickname: Maybe<string>
}

const stringValidation = ValidatedNea.getValidation<string>()

const validateMemberRename = (
  entry: GuildAuditLogsEntry<AuditLogEvent.MemberUpdate>,
): ValidatedNea<string, MemberRename> =>
  pipe(
    apply.sequenceS(stringValidation)({
      executor: pipe(
        Maybe.fromNullable(entry.executor),
        ValidatedNea.fromOption(() => 'executor was not defined'),
      ),
      nickChange: pipe(
        entry.changes,
        List.filter(change => change.key === 'nick'),
        List.match(
          () => ValidatedNea.invalid('No nick change found'),
          nea =>
            nea.length === 1
              ? ValidatedNea.valid(NonEmptyArray.head(nea))
              : ValidatedNea.invalid('More than one nick changes found'),
        ),
        Either.chain(nickChange => {
          const validateNick = <K extends keyof AuditLogChange>(
            key: K,
          ): ValidatedNea<string, Maybe<string>> =>
            pipe(
              Maybe.decoder(D.string).decode(nickChange[key]),
              Either.mapLeft(e => NonEmptyArray.of(`nickChange.${key}: ${D.draw(e)}`)),
            )
          return pipe(
            apply.sequenceS(stringValidation)({
              oldNickname: validateNick('old'),
              newNickname: validateNick('new'),
            }),
          )
        }),
      ),
    }),
    Either.map(
      ({ executor, nickChange: { oldNickname, newNickname } }): MemberRename => ({
        executor,
        oldNickname,
        newNickname,
      }),
    ),
  )

const getDisplayName = (user: User, nickname: Maybe<string>): string =>
  pipe(
    nickname,
    Maybe.getOrElse(() => user.username),
  )

const formatNickname = (nickname: Maybe<string>): string =>
  pipe(nickname, Maybe.toNullable, JSON.stringify)

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

const sendRenamedDM = (member: GuildMember, content: string): Future<Maybe<Message<false>>> =>
  DiscordConnector.sendMessage(member, {
    embeds: [
      MessageComponent.safeEmbed({
        color: constants.messagesColor,
        title: `[Serveur ${member.guild.name}]`,
        url: DiscordUtils.urls.guild(GuildId.fromGuild(member.guild)),
        description: content,
      }),
    ],
  })

const renamedOnJoinMessage = (member: GuildMember): string =>
  StringUtils.stripMargins(
    `Haha !
      |Pour info, je t'ai renommé **${member.displayName}** sur le serveur **${member.guild.name}**, vu qu'il faut que TOUT LE MONDE ait *"UwU"* (ou *"OwO"*) dans son pseudal.
      |Oui, je sais, ce serveur a des standards bizarres.`,
  )

const renamedBackMessage = (member: GuildMember, forbiddenRenameAttempt: Maybe<string>): string =>
  StringUtils.stripMargins(
    `Haha !
      |Tu as essayé de te renommer **${pipe(
        forbiddenRenameAttempt,
        Maybe.getOrElse(() => member.user.username),
      )}** sur le serveur **${member.guild.name}**.
      |Or, il faut que TOUT LE MONDE ait *"UwU"* (ou *"OwO"*) dans son pseudal.
      |J'ai donc annulé ton renommage (en te repassant à **${member.displayName}**).`,
  )

export { UwURenamerObserver }
