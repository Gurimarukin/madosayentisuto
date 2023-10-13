import type { Guild, GuildMember } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { DiscordUserId } from '../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../shared/utils/StringUtils'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, List, Maybe, NonEmptyArray, Tuple, toNotUsed } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { constants } from '../config/constants'
import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { MemberBirthdate } from '../models/member/MemberBirthdate'
import type { GuildStateService } from '../services/GuildStateService'
import type { MemberBirthdateService } from '../services/MemberBirthdateService'
import type { GuildSendableChannel } from '../utils/ChannelUtils'

export const NotifyBirthdayObserver = (
  discord: DiscordConnector,
  guildStateService: GuildStateService,
  memberBirthdateService: MemberBirthdateService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'CronJob',
  )(({ date }) =>
    pipe(date, DayJs.isHourSharp(8))
      ? pipe(
          memberBirthdateService.listForDate(date),
          Future.chain(members =>
            List.isNonEmpty(members) ? notifyMembers(date, members) : Future.notUsed,
          ),
        )
      : Future.notUsed,
  )

  function notifyMembers(now: DayJs, members: NonEmptyArray<MemberBirthdate>): Future<NotUsed> {
    return pipe(
      discord.listGuilds,
      Future.fromIOEither,
      Future.chain(List.traverse(Future.ApplicativeSeq)(maybeNotifyMembersForGuild(now, members))),
      Future.map(toNotUsed),
    )
  }

  function maybeNotifyMembersForGuild(
    now: DayJs,
    memberBirthdates: NonEmptyArray<MemberBirthdate>,
  ): (guild: Guild) => Future<NotUsed> {
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
        Future.map(toNotUsed),
      )
  }

  function notifyMembersForChannel(
    now: DayJs,
    channel: GuildSendableChannel,
    members: NonEmptyArray<Tuple<GuildMember, DayJs>>,
  ): Future<NotUsed> {
    return pipe(
      members,
      NonEmptyArray.traverse(Future.ApplicativeSeq)(member =>
        pipe(
          DiscordConnector.sendMessage(channel, { content: birthdayMessage(now, member) }),
          futureMaybe.chainFirstTaskEitherK(m =>
            DiscordConnector.messageReact(m, constants.emojis.birthday),
          ),
          futureMaybe.chainFirstTaskEitherK(m =>
            DiscordConnector.messageReact(m, constants.emojis.tada),
          ),
        ),
      ),
      Future.map(toNotUsed),
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
