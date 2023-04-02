import { pipe } from 'fp-ts/function'

import { DayJs } from '../../shared/models/DayJs'
import { ObserverWithRefinement } from '../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../shared/utils/fp'
import { Future, IO, List } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import type { Config } from '../config/Config'
import type { DiscordConnector } from '../helpers/DiscordConnector'
import type { TheQuestHelper } from '../helpers/TheQuestHelper'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerObservable'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const TheQuestObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
  guildStateService: GuildStateService,
  theQuestHelper: TheQuestHelper,
) => {
  const logger = Logger('TheQuestObserver')

  const sendNotificationsAndRefreshMessage: Future<NotUsed> = pipe(
    discord.listGuilds,
    Future.fromIOEither,
    Future.chain(
      List.traverse(Future.ApplicativePar)(guild =>
        pipe(
          guildStateService.getTheQuestMessage(guild),
          futureMaybe.chainFirstIOEitherK(message =>
            LogUtils.pretty(logger, guild, null, message.channel).debug(
              'Sending notification and refreshing The Quest message',
            ),
          ),
          futureMaybe.chain(message =>
            theQuestHelper.sendNotificationsAndRefreshMessage(logger)(guild, message.channel),
          ),
        ),
      ),
    ),
    Future.chainIOEitherK(messages =>
      List.isEmpty(List.compact(messages))
        ? logger.debug('No The Quest message in any guild')
        : IO.notUsed,
    ),
  )

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
    'CronJob',
  )(event => {
    switch (event.type) {
      case 'AppStarted':
        return config.isDev ? sendNotificationsAndRefreshMessage : Future.notUsed
      case 'CronJob':
        return !config.isDev &&
          pipe(event.date, DayJs.minute.get) % config.theQuest.refreshEveryMinutes === 0
          ? sendNotificationsAndRefreshMessage
          : Future.notUsed
    }
  })
}
