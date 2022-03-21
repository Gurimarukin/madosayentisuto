import type { Guild, GuildMember, TextChannel } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { UserId } from '../../shared/models/guild/UserId'
import { futureMaybe } from '../../shared/utils/FutureMaybe'
import { StringUtils } from '../../shared/utils/StringUtils'
import { NonEmptyArray, Tuple, toUnit } from '../../shared/utils/fp'
import { Maybe } from '../../shared/utils/fp'
import { Future, List } from '../../shared/utils/fp'

import { constants } from '../constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventCronJob } from '../models/event/MadEvent'
import type { MemberBirthdate } from '../models/member/MemberBirthdate'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import type { MemberBirthdateService } from '../services/MemberBirthdateService'

export const NotifyBirthdayObserver = (
  discord: DiscordConnector,
  guildStateService: GuildStateService,
  memberBirthdateService: MemberBirthdateService,
): TObserver<MadEventCronJob> => {
  return {
    next: event =>
      DayJs.is8am(event.date)
        ? pipe(
            memberBirthdateService.listForDate(event.date),
            Future.chain(members =>
              List.isNonEmpty(members) ? notifyMembers(event.date, members) : Future.unit,
            ),
          )
        : Future.unit,
  }

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
                    guildMembers.find(gm => UserId.wrap(gm.user.id) === id),
                    Maybe.fromNullable,
                    Maybe.map(m => Tuple.of(m, birthdate)),
                  ),
                ),
                NonEmptyArray.fromReadonlyArray,
              ),
            ),
          ),
        }),
        futureMaybe.chainFuture(({ channel, members }) =>
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
          futureMaybe.chainFirstFuture(m =>
            DiscordConnector.messageReact(m, constants.emojis.birthday),
          ),
          futureMaybe.chainFirstFuture(m =>
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
