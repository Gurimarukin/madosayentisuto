import type { Guild, GuildMember, TextChannel } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { StringUtils } from '../../shared/utils/StringUtils'
import { NonEmptyArray, Tuple, toUnit } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { MemberBirthdate } from '../models/member/MemberBirthdate'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { GuildStateService } from '../services/GuildStateService'
import type { MemberBirthdateService } from '../services/MemberBirthdateService'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const NotifyBirthdayObserver = (
  discord: DiscordConnector,
  guildStateService: GuildStateService,
  memberBirthdateService: MemberBirthdateService,
) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) =>
    pipe(date, DayJs.isHourSharp(8))
      ? pipe(
          memberBirthdateService.listForDate(date),
          Future.chain(members =>
            List.isNonEmpty(members) ? notifyMembers(date, members) : Future.unit,
          ),
        )
      : Future.unit,
  )

  function notifyMembers(now: DayJs, members: NonEmptyArray<MemberBirthdate>): Future<void> {
    return pipe(
      discord.listGuilds,
      Future.fromIOEither,
      Future.chain(Future.traverseArray(maybeNotifyMembersForGuild(now, members))),
      Future.map(toUnit),
    )
  }

  function maybeNotifyMembersForGuild(
    now: DayJs,
    memberBirthdates: NonEmptyArray<MemberBirthdate>,
  ): (guild: Guild) => Future<void> {
    return guild =>
      pipe(
        apply.sequenceS(futureMaybe.ApplyPar)({
          channel: guildStateService.getBirthdayChannel(guild),
          members: pipe(
            DiscordConnector.fetchMembers(guild),
            Future.map(guildMembers =>
              pipe(
                memberBirthdates,
                List.filterMap(({ id, birthdate }) =>
                  pipe(
                    guildMembers.find(gm => DiscordUserId.fromUser(gm.user) === id),
                    Maybe.fromNullable,
                    Maybe.map(m => Tuple.of(m, birthdate)),
                  ),
                ),
                NonEmptyArray.fromReadonlyArray,
              ),
            ),
          ),
        }),
        futureMaybe.chainTaskEitherK(({ channel, members }) =>
          notifyMembersForChannel(now, channel, members),
        ),
        Future.map(toUnit),
      )
  }

  function notifyMembersForChannel(
    now: DayJs,
    channel: TextChannel,
    members: NonEmptyArray<Tuple<GuildMember, DayJs>>,
  ): Future<void> {
    return pipe(
      members,
      Future.traverseArray(member =>
        pipe(
          DiscordConnector.sendPrettyMessage(channel, birthdayMessage(now, member)),
          futureMaybe.chainFirstTaskEitherK(m =>
            DiscordConnector.messageReact(m, constants.emojis.birthday),
          ),
          futureMaybe.chainFirstTaskEitherK(m =>
            DiscordConnector.messageReact(m, constants.emojis.tada),
          ),
        ),
      ),
      Future.map(toUnit),
    )
  }
}

const birthdayMessage = (now: DayJs, [member, birthdate]: Tuple<GuildMember, DayJs>): string => {
  const age = pipe(now, DayJs.diff(birthdate, 'years'))
  return StringUtils.stripMargins(
    `Haha ${member}, déjà ${age} ans ?!
    |Je ne pensais pas que tu tiendrais jusque-là...`,
  )
}
