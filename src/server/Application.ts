import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { ServerToClientEvent } from '../shared/models/event/ServerToClientEvent'
import { ObserverWithRefinement } from '../shared/models/rx/ObserverWithRefinement'
import { PubSub } from '../shared/models/rx/PubSub'
import { PubSubUtils } from '../shared/utils/PubSubUtils'
import { Future, IO } from '../shared/utils/fp'

import type { Context } from './Context'
import { ActivityStatusObserver } from './domain/ActivityStatusObserver'
import { CallsAutoroleObserver } from './domain/CallsAutoroleObserver'
import { DisconnectVocalObserver } from './domain/DisconnectVocalObserver'
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
import { LogMadEventsObserver } from './helpers/LogMadEventsObserver'
import { VoiceStateUpdateTransformer } from './helpers/VoiceStateUpdateTransformer'
import { publishDiscordEvents } from './helpers/publishDiscordEvents'
import { scheduleCronJob } from './helpers/scheduleCronJob'
import { MadEvent } from './models/event/MadEvent'
import type { WSServerEvent } from './models/event/WSServerEvent'
import { BotStateService } from './services/BotStateService'
import { GuildStateService } from './services/GuildStateService'
import { MemberBirthdateService } from './services/MemberBirthdateService'
import { PollService } from './services/PollService'
import { ScheduledEventService } from './services/ScheduledEventService'
import { UserService } from './services/UserService'
import { Routes } from './webServer/Routes'
import { DiscordClientController } from './webServer/controllers/DiscordClientController'
import { HealthCheckController } from './webServer/controllers/HealthCheckController'
import { UserController } from './webServer/controllers/UserController'
import { startWebServer } from './webServer/startWebServer'
import { WithAuth } from './webServer/utils/WithAuth'

export const Application = (
  discord: DiscordConnector,
  {
    config,
    loggerObservable,
    botStatePersistence,
    guildStatePersistence,
    memberBirthdatePersistence,
    pollQuestionPersistence,
    pollResponsePersistence,
    scheduledEventPersistence,
    userPersistence,
    healthCheckService,
    ytDlp,
    jwtHelper,
  }: Context,
): IO<void> => {
  const { Logger } = loggerObservable
  const logger = Logger('Application')

  const clientId = config.client.id

  const botStateService = BotStateService(Logger, discord, botStatePersistence)
  const guildStateService = GuildStateService(Logger, discord, ytDlp, guildStatePersistence)
  const memberBirthdateService = MemberBirthdateService(memberBirthdatePersistence)
  const pollService = PollService(pollQuestionPersistence, pollResponsePersistence)
  const scheduledEventService = ScheduledEventService(scheduledEventPersistence)
  const userService = UserService(Logger, userPersistence, jwtHelper)

  const healthCheckController = HealthCheckController(healthCheckService)
  const discordClientController = DiscordClientController(
    Logger,
    discord,
    guildStateService,
    memberBirthdateService,
    scheduledEventService,
  )
  const userController = UserController(userService)

  const withAuth = WithAuth(userService)

  const routes = Routes(withAuth, healthCheckController, userController, discordClientController)

  const madEventsPubSub = PubSub<MadEvent>()
  const sub = PubSubUtils.subscribeWithRefinement<MadEvent>(logger, madEventsPubSub.observable)

  const serverToClientEventPubSub = PubSub<ServerToClientEvent>()
  const wsServerEventPubSub = PubSub<WSServerEvent>()

  return pipe(
    loggerObservable.subscribe('debug', {
      next: ({ name, level, message }) =>
        Future.fromIOEither(
          serverToClientEventPubSub.subject.next(ServerToClientEvent.Log({ name, level, message })),
        ),
    }),
    IO.chain(() =>
      apply.sequenceT(IO.ApplyPar)(
        // └ domain/
        // │  └ commands/
        sub(AdminCommandsObserver(Logger, discord, botStateService, guildStateService)),
        sub(MusicCommandsObserver(Logger, ytDlp, guildStateService)),
        sub(OtherCommandsObserver()),
        sub(PollCommandsObserver(Logger, config, discord, pollService)),
        sub(RemindCommandsObserver(scheduledEventService)),
        // │  └ startup/
        sub(DeployCommandsObserver(Logger, config, discord)),
        // │
        sub(ActivityStatusObserver(botStateService)),
        sub(CallsAutoroleObserver(Logger, guildStateService)),
        sub(DisconnectVocalObserver(clientId, guildStateService)),
        sub(MusicThreadCleanObserver(Logger, clientId, guildStateService)),
        sub(NotifyBirthdayObserver(discord, guildStateService, memberBirthdateService)),
        sub(NotifyGuildLeaveObserver(Logger)),
        sub(NotifyVoiceCallObserver(Logger, guildStateService)),
        sub(ScheduledEventObserver(Logger, discord, scheduledEventService, guildStateService)),
        sub(ScheduleItsFridayObserver(Logger, scheduledEventService)),
        sub(SendWelcomeDMObserver(Logger)),
        sub(SetDefaultRoleObserver(Logger, guildStateService)),
        sub(TextInteractionsObserver(config.captain, discord)),
        // └ helpers/
        sub(ObserverWithRefinement.of(LogMadEventsObserver(logger))),
        publishDiscordEvents(discord, madEventsPubSub.subject),
        scheduleCronJob(Logger, madEventsPubSub.subject),
        sub(VoiceStateUpdateTransformer(Logger, clientId, madEventsPubSub.subject)),
      ),
    ),
    IO.chain(() =>
      startWebServer(
        Logger,
        config.http,
        routes,
        serverToClientEventPubSub.observable,
        wsServerEventPubSub.subject,
      ),
    ),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
