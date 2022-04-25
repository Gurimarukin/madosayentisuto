import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { ChannelId } from '../../../shared/models/ChannelId'
import type { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ScheduledEventView } from '../../../shared/models/ScheduledEventView'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { GuildView } from '../../../shared/models/guild/GuildView'
import { GuildViewShort } from '../../../shared/models/guild/GuildViewShort'
import { Future, IO, List, Maybe } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'
import { DayJsFromISOString } from '../../../shared/utils/ioTsUtils'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { LoggerGetter } from '../../models/logger/LoggerGetter'
import { TObjectId } from '../../models/mongo/TObjectId'
import { Sink } from '../../models/rx/Sink'
import { TObservable } from '../../models/rx/TObservable'
import type { ScheduledEventWithId } from '../../models/scheduledEvent/ScheduledEventWithId'
import type { MemberBirthdateService } from '../../services/MemberBirthdateService'
import type { ScheduledEventService } from '../../services/ScheduledEventService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import type { EndedMiddleware } from '../models/MyMiddleware'
import { MyMiddleware as M } from '../models/MyMiddleware'

export type DiscordClientController = ReturnType<typeof DiscordClientController>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DiscordClientController = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  memberBirthdateService: MemberBirthdateService,
  scheduledEventService: ScheduledEventService,
) => {
  const logger = Logger('DiscordClientController')

  return {
    listGuilds: (/* user: User */): EndedMiddleware =>
      pipe(
        discord.listGuilds,
        IO.map(List.map(GuildViewShort.fromGuild)),
        M.fromIOEither,
        M.ichain(M.jsonWithStatus(Status.OK, List.encoder(GuildViewShort.codec))),
      ),

    findGuild: (guildId: GuildId) => (/* user: User */): EndedMiddleware =>
      pipe(
        Future.fromIOEither(discord.getGuild(guildId)),
        futureMaybe.chain(guild =>
          pipe(
            DiscordConnector.fetchMembers(guild),
            Future.map(c => GuildView.fromGuild(guild, c.toJSON())),
            futureMaybe.fromTaskEither,
          ),
        ),
        futureMaybe.chain(guild =>
          pipe(
            guild.members,
            List.map(m => m.id),
            memberBirthdateService.listForMembers,
            Future.map(birthdates => pipe(guild, GuildView.updateBirthdates(birthdates))),
            futureMaybe.fromTaskEither,
          ),
        ),
        M.fromTaskEither,
        M.ichain(
          Maybe.fold(
            () => M.sendWithStatus(Status.NotFound)(''),
            M.jsonWithStatus(Status.OK, GuildView.codec),
          ),
        ),
      ),

    updateMemberBirthdate: (userId: DiscordUserId) => (/* user: User */): EndedMiddleware =>
      /* User.canUpdateMember(user) */
      pipe(
        M.decodeBody([DayJsFromISOString.decoder, 'DayJsFromISOString']),
        M.matchE(
          () => M.of(false),
          birthdate => M.fromTaskEither(memberBirthdateService.upsert(userId, birthdate)),
        ),
        M.ichain(success =>
          success
            ? M.sendWithStatus(Status.NoContent)('')
            : M.sendWithStatus(Status.BadRequest)(''),
        ),
      ),

    deleteMemberBirthdate: (userId: DiscordUserId) => (/* user: User */): EndedMiddleware =>
      pipe(
        memberBirthdateService.remove(userId),
        M.fromTaskEither,
        M.ichain(success =>
          success
            ? M.sendWithStatus(Status.NoContent)('')
            : M.sendWithStatus(Status.BadRequest)(''),
        ),
      ),

    listScheduledEvents: (/* user: User */): EndedMiddleware =>
      pipe(
        scheduledEventService.list,
        TObservable.chainTaskEitherK(scheduledEventView),
        TObservable.compact,
        Sink.readonlyArray,
        M.fromTaskEither,
        M.ichain(M.jsonWithStatus(Status.OK, List.encoder(ScheduledEventView.codec))),
      ),
  }

  function scheduledEventView(event: ScheduledEventWithId): Future<Maybe<ScheduledEventView>> {
    switch (event.type) {
      case 'Reminder':
        return pipe(
          apply.sequenceS(futureMaybe.ApplyPar)({
            createdBy: discord.fetchUser(event.reminder.createdBy),
            who: pipe(
              event.reminder.who,
              Maybe.fold(
                () => futureMaybe.some(Maybe.none),
                who =>
                  pipe(
                    apply.sequenceS(futureMaybe.ApplyPar)({
                      guild: Future.fromIOEither(discord.getGuild(who.guild)),
                      channel: pipe(
                        discord.fetchChannel(who.channel),
                        futureMaybe.filter(ChannelUtils.isBaseGuildTextChannel),
                      ),
                    }),
                    futureMaybe.bind('role', ({ guild }) =>
                      DiscordConnector.fetchRole(guild, who.role),
                    ),
                    futureMaybe.map(Maybe.some),
                  ),
              ),
            ),
          }),
          futureMaybe.map(({ createdBy, who }) =>
            ScheduledEventView.Reminder({
              scheduledAt: event.scheduledAt,
              createdBy: {
                tag: createdBy.tag,
                avatar: Maybe.fromNullable(createdBy.displayAvatarURL({ dynamic: true })),
              },
              who: pipe(
                who,
                Maybe.map(({ guild, channel, role }) => ({
                  guild: {
                    id: GuildId.fromGuild(guild),
                    name: guild.name,
                    icon: Maybe.fromNullable(guild.iconURL()),
                  },
                  channel: {
                    id: ChannelId.fromChannel(channel),
                    name: channel.name,
                  },
                  role: { name: role.name, color: role.hexColor },
                })),
              ),
              what: event.reminder.what,
            }),
          ),
          Future.chainFirstIOEitherK(
            Maybe.fold(
              () =>
                logger.warn(
                  `Failed to create view for scheduled event ${TObjectId.unwrap(event._id)}`,
                ),
              () => IO.unit,
            ),
          ),
        )

      case 'ItsFriday':
        return futureMaybe.some(
          ScheduledEventView.ItsFriday({
            scheduledAt: event.scheduledAt,
          }),
        )
    }
  }
}
