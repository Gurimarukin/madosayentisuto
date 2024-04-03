import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { Status } from 'hyper-ts'

import { ScheduledEventView } from '../../shared/models/ScheduledEventView'
import { Future, IO, List, Maybe } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import { TObjectId } from '../models/mongo/TObjectId'
import { ScheduledEvent } from '../models/scheduledEvent/ScheduledEvent'
import type { ScheduledEventWithId } from '../models/scheduledEvent/ScheduledEventWithId'
import type { ScheduledEventService } from '../services/ScheduledEventService'
import { ChannelUtils } from '../utils/ChannelUtils'
import type { EndedMiddleware } from '../webServer/models/MyMiddleware'
import { MyMiddleware as M } from '../webServer/models/MyMiddleware'

export type ScheduledEventController = ReturnType<typeof ScheduledEventController>

export const ScheduledEventController = (
  Logger: LoggerGetter,
  discord: DiscordConnector,
  scheduledEventService: ScheduledEventService,
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
) => {
  const logger = Logger('ScheduledEventController')

  return {
    listScheduledEvents: (/* user: User */): EndedMiddleware =>
      pipe(
        scheduledEventService.list,
        Future.chain(List.traverse(Future.ApplicativePar)(scheduledEventView)),
        Future.map(List.compact),
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
                        futureMaybe.filter(ChannelUtils.isNamed),
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
            ScheduledEvent.reminderToView({
              scheduledAt: event.scheduledAt,
              createdBy,
              who,
              what: event.reminder.what,
            }),
          ),
          Future.chainFirstIOEitherK(
            Maybe.fold(
              () =>
                logger.warn(
                  `Failed to create view for scheduled event ${TObjectId.unwrap(event._id)}`,
                ),
              () => IO.notUsed,
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
