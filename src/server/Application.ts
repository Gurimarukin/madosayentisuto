import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import type { ServerToClientEvent } from '../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../shared/models/rx/PubSub'
import { PubSubUtils } from '../shared/utils/PubSubUtils'
import type { NotUsed } from '../shared/utils/fp'
import { IO } from '../shared/utils/fp'

import type { Context } from './Context'
import { constants } from './config/constants'
import { ActivityStatusObserver } from './domain/ActivityStatusObserver'
import { AutoroleObserver } from './domain/AutoroleObserver'
import { DisconnectVocalObserver } from './domain/DisconnectVocalObserver'
import { ElevatorObserver } from './domain/ElevatorObserver'
import { MusicThreadCleanObserver } from './domain/MusicThreadCleanObserver'
import { NotifyBirthdayObserver } from './domain/NotifyBirthdayObserver'
import { NotifyGuildLeaveObserver } from './domain/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './domain/NotifyVoiceCallObserver'
import { ScheduleItsFridayObserver } from './domain/ScheduleItsFridayObserver'
import { ScheduledEventObserver } from './domain/ScheduledEventObserver'
import { SendWelcomeDMObserver } from './domain/SendWelcomeDMObserver'
import { SetDefaultRoleObserver } from './domain/SetDefaultRoleObserver'
import { TextInteractionsObserver } from './domain/TextInteractionsObserver'
import { AdminCommandsObserver } from './domain/commands/AdminCommandsObserver'
import { MusicCommandsObserver } from './domain/commands/MusicCommandsObserver'
import { OtherCommandsObserver } from './domain/commands/OtherCommandsObserver'
import { PollCommandsObserver } from './domain/commands/PollCommandsObserver'
import { RemindCommandsObserver } from './domain/commands/RemindCommandsObserver'
import { DeployCommandsObserver } from './domain/startup/DeployCommandsObserver'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { LogMadEventObserver } from './helpers/LogMadEventObserver'
import { LogObserver } from './helpers/LogObserver'
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
import { UserService } from './services/UserService'
import { getOnError } from './utils/getOnError'
import { Routes } from './webServer/Routes'
import { DiscordClientController } from './webServer/controllers/DiscordClientController'
import { HealthCheckController } from './webServer/controllers/HealthCheckController'
import { LogController } from './webServer/controllers/LogController'
import { MemberController } from './webServer/controllers/MemberController'
import { ScheduledEventController } from './webServer/controllers/ScheduledEventController'
import { UserController } from './webServer/controllers/UserController'
import { startWebServer } from './webServer/startWebServer'
import { RateLimiter } from './webServer/utils/RateLimiter'
import { WithAuth } from './webServer/utils/WithAuth'
import { WithIp } from './webServer/utils/WithIp'

export const Application = (
  discord: DiscordConnector,
  {
    config,
    loggerObservable,
    botStatePersistence,
    logPersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    userPersistence,
    healthCheckService,
    jwtHelper,
    resourcesHelper,
    ytDlp,
  }: Context,
): IO<NotUsed> => {
  const { Logger } = loggerObservable
  const logger = Logger('Application')

  const clientId = config.client.id

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const logService = LogService(logPersistence)
  const guildStateService = GuildStateService(
    Logger,
    discord,
    resourcesHelper,
    ytDlp,
    guildStatePersistence,
  )
  const memberBirthdateService = MemberBirthdateService(memberBirthdatePersistence)
  const pollService = PollService(pollQuestionPersistence, pollResponsePersistence)
  const scheduledEventService = ScheduledEventService(scheduledEventPersistence)
  const userService = UserService(Logger, userPersistence, jwtHelper)

  const serverToClientEventPubSub = PubSub<ServerToClientEvent>()
  const wsServerEventPubSub = PubSub<WSServerEvent>() // TODO: do something with wsServerEventPubSub.observable?

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
  const memberController = MemberController(Logger, memberBirthdateService)
  const scheduledEventController = ScheduledEventController(Logger, discord, scheduledEventService)
  const userController = UserController(userService)

  const withIp = WithIp(Logger, config)
  const rateLimiter = RateLimiter(Logger, withIp, constants.rateLimiterLifeTime)
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
        AdminCommandsObserver(Logger, config.admins, discord, botStateService, guildStateService),
      ),
      sub(MusicCommandsObserver(Logger, ytDlp, guildStateService)),
      sub(OtherCommandsObserver()),
      sub(PollCommandsObserver(Logger, config, discord, pollService)),
      sub(RemindCommandsObserver(scheduledEventService)),
      // │  └ startup/
      sub(DeployCommandsObserver(Logger, config.client, discord)),
      // │
      sub(ActivityStatusObserver(botStateService)),
      sub(AutoroleObserver(Logger)),
      sub(DisconnectVocalObserver(clientId, guildStateService)),
      sub(ElevatorObserver(Logger, guildStateService)),
      sub(MusicThreadCleanObserver(Logger, clientId, guildStateService)),
      sub(NotifyBirthdayObserver(discord, guildStateService, memberBirthdateService)),
      sub(NotifyGuildLeaveObserver(Logger)),
      sub(NotifyVoiceCallObserver(Logger, clientId, guildStateService)),
      sub(ScheduledEventObserver(Logger, discord, scheduledEventService, guildStateService)),
      sub(ScheduleItsFridayObserver(Logger, scheduledEventService)),
      sub(SendWelcomeDMObserver(Logger)),
      sub(SetDefaultRoleObserver(Logger, guildStateService)),
      sub(TextInteractionsObserver(config.captain, discord)),
      // └ helpers/
      sub(ObserverWithRefinement.of(LogMadEventObserver(logger))),
      loggerObservable.subscribe('debug', logsObserver.logEventObserver),
      sub(logsObserver.madEventObserver),
      publishDiscordEvents(logger, discord, madEventsPubSub.subject),
      scheduleCronJob(Logger, madEventsPubSub.subject),
      sub(VoiceStateUpdateTransformer(clientId, madEventsPubSub.subject)),
    ),
    IO.chain(() => startWebServer(Logger, config.http, routes)),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
