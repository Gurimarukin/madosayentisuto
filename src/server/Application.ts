import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { MsDuration } from '../shared/models/MsDuration'
import type { ServerToClientEvent } from '../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../shared/models/rx/PubSub'
import { PubSubUtils } from '../shared/utils/PubSubUtils'
import type { NotUsed } from '../shared/utils/fp'
import { IO } from '../shared/utils/fp'

import type { Context } from './Context'
import { DiscordClientController } from './controllers/DiscordClientController'
import { HealthCheckController } from './controllers/HealthCheckController'
import { LogController } from './controllers/LogController'
import { MemberController } from './controllers/MemberController'
import { ScheduledEventController } from './controllers/ScheduledEventController'
import { UserController } from './controllers/UserController'
import { ActivityStatusObserver } from './domain/ActivityStatusObserver'
import { AutoroleObserver } from './domain/AutoroleObserver'
import { DisconnectVocalObserver } from './domain/DisconnectVocalObserver'
import { NotifyBirthdayObserver } from './domain/NotifyBirthdayObserver'
import { NotifyGuildLeaveObserver } from './domain/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './domain/NotifyVoiceCallObserver'
import { PlayerThreadCleanObserver } from './domain/PlayerThreadCleanObserver'
import { ScheduleItsFridayObserver } from './domain/ScheduleItsFridayObserver'
import { ScheduledEventObserver } from './domain/ScheduledEventObserver'
import { SendWelcomeDMObserver } from './domain/SendWelcomeDMObserver'
import { SetDefaultRoleObserver } from './domain/SetDefaultRoleObserver'
import { TextInteractionsObserver } from './domain/TextInteractionsObserver'
import { TheQuestObserver } from './domain/TheQuestObserver'
import { UwURenamerObserver } from './domain/UwURenamerObserver'
import { AdminCommandsObserver } from './domain/commands/AdminCommandsObserver'
import { OtherCommandsObserver } from './domain/commands/OtherCommandsObserver'
import { PlayerCommandsObserver } from './domain/commands/PlayerCommandsObserver'
import { PollCommandsObserver } from './domain/commands/PollCommandsObserver'
import { RemindCommandsObserver } from './domain/commands/RemindCommandsObserver'
import { DeployCommandsObserver } from './domain/startup/DeployCommandsObserver'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { LogMadEventObserver } from './helpers/LogMadEventObserver'
import { LogObserver } from './helpers/LogObserver'
import { TheQuestHelper } from './helpers/TheQuestHelper'
import { VoiceStateUpdateTransformer } from './helpers/VoiceStateUpdateTransformer'
import { publishDiscordEvents } from './helpers/publishDiscordEvents'
import { scheduleCronJob } from './helpers/scheduleCronJob'
import { MadEvent } from './models/event/MadEvent'
import type { WSServerEvent } from './models/event/WSServerEvent'
import { BotStateService } from './services/BotStateService'
import { GuildStateService } from './services/GuildStateService'
import { LogService } from './services/LogService'
import { MemberBirthdateService } from './services/MemberBirthdateService'
import { PollService } from './services/PollService'
import { ScheduledEventService } from './services/ScheduledEventService'
import { TheQuestService } from './services/TheQuestService'
import { UserService } from './services/UserService'
import { getOnError } from './utils/getOnError'
import { Routes } from './webServer/Routes'
import { startWebServer } from './webServer/startWebServer'
import { RateLimiter } from './webServer/utils/RateLimiter'
import { WithAuth } from './webServer/utils/WithAuth'
import { WithIp } from './webServer/utils/WithIp'

const rateLimiterLifeTime = MsDuration.days(1)

export const Application = (
  discord: DiscordConnector,
  {
    config,
    resources,
    loggerObservable,
    botStatePersistence,
    logPersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    theQuestProgressionPersistence,
    userPersistence,
    httpClient,
    emojidexService,
    healthCheckService,
    jwtHelper,
    resourcesHelper,
    ytDlp,
  }: Context,
): IO<NotUsed> => {
  const { Logger } = loggerObservable
  const logger = Logger('Application')

  const serverToClientEventPubSub = PubSub<ServerToClientEvent>()
  const wsServerEventPubSub = PubSub<WSServerEvent>() // TODO: do something with wsServerEventPubSub.observable?

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const logService = LogService(logPersistence)
  const guildStateService = GuildStateService(
    Logger,
    discord,
    ytDlp,
    guildStatePersistence,
    serverToClientEventPubSub.subject,
  )
  const memberBirthdateService = MemberBirthdateService(memberBirthdatePersistence)
  const pollService = PollService(pollQuestionPersistence, pollResponsePersistence)
  const scheduledEventService = ScheduledEventService(scheduledEventPersistence)
  const theQuestService = TheQuestService(
    config.theQuest,
    theQuestProgressionPersistence,
    httpClient,
  )
  const userService = UserService(Logger, userPersistence, jwtHelper)

  const theQuestHelper = TheQuestHelper(
    config.theQuest,
    resources,
    guildStateService,
    theQuestService,
  )

  const discordClientController = DiscordClientController(
    discord,
    guildStateService,
    memberBirthdateService,
  )
  const healthCheckController = HealthCheckController(healthCheckService)
  const logController = LogController(
    Logger,
    logService,
    serverToClientEventPubSub.observable,
    wsServerEventPubSub.subject,
  )
  const memberController = MemberController(memberBirthdateService)
  const scheduledEventController = ScheduledEventController(Logger, discord, scheduledEventService)
  const userController = UserController(userService)

  const withIp = WithIp(Logger, config)
  const rateLimiter = RateLimiter(Logger, withIp, rateLimiterLifeTime)
  const withAuth = WithAuth(userService)

  const routes = Routes(
    rateLimiter,
    withAuth,
    discordClientController,
    healthCheckController,
    logController,
    memberController,
    scheduledEventController,
    userController,
  )

  const madEventsPubSub = PubSub<MadEvent>()
  const sub = PubSubUtils.subscribeWithRefinement<MadEvent>(
    getOnError(logger),
    madEventsPubSub.observable,
  )

  const logsObserver = LogObserver(logService, serverToClientEventPubSub.subject)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ domain/
      // │  └ commands/
      sub(
        AdminCommandsObserver(
          Logger,
          config,
          discord,
          theQuestHelper,
          emojidexService,
          botStateService,
          guildStateService,
        ),
      ),
      sub(OtherCommandsObserver(config)),
      sub(PlayerCommandsObserver(Logger, resourcesHelper, ytDlp, guildStateService)),
      sub(PollCommandsObserver(Logger, config, discord, pollService)),
      sub(RemindCommandsObserver(scheduledEventService)),
      // │  └ startup/
      sub(DeployCommandsObserver(Logger, config, discord)),
      // │
      sub(ActivityStatusObserver(botStateService)),
      sub(AutoroleObserver(Logger)),
      sub(DisconnectVocalObserver(config.client.id, guildStateService)),
      sub(NotifyBirthdayObserver(discord, guildStateService, memberBirthdateService)),
      sub(NotifyGuildLeaveObserver(Logger)),
      sub(NotifyVoiceCallObserver(Logger, config.client.id, guildStateService)),
      sub(PlayerThreadCleanObserver(Logger, config.client.id, guildStateService)),
      sub(ScheduledEventObserver(Logger, discord, scheduledEventService, guildStateService)),
      sub(ScheduleItsFridayObserver(Logger, scheduledEventService)),
      sub(SendWelcomeDMObserver(Logger)),
      sub(SetDefaultRoleObserver(Logger, guildStateService)),
      sub(TextInteractionsObserver(config.captain, discord)),
      sub(TheQuestObserver(Logger, config, discord, guildStateService, theQuestHelper)),
      sub(UwURenamerObserver(Logger, config.client.id, config.uwuGuilds)),
      // └ helpers/
      sub(ObserverWithRefinement.of(LogMadEventObserver(logger))),
      loggerObservable.subscribe('debug', logsObserver.logEventObserver),
      sub(logsObserver.madEventObserver),
      publishDiscordEvents(logger, discord, madEventsPubSub.subject),
      scheduleCronJob(Logger, madEventsPubSub.subject),
      sub(VoiceStateUpdateTransformer(madEventsPubSub.subject)),
    ),
    IO.chain(() => startWebServer(Logger, config.http, routes)),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
