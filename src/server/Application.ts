import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { IO } from '../shared/utils/fp'

import type { Config } from './Config'
import { Context } from './Context'
import { ActivityStatusObserver } from './domain/ActivityStatusObserver'
import { CallsAutoroleObserver } from './domain/CallsAutoroleObserver'
import { DisconnectVocalObserver } from './domain/DisconnectVocalObserver'
import { ItsFridayObserver } from './domain/ItsFridayObserver'
import { MusicThreadCleanObserver } from './domain/MusicThreadCleanObserver'
import { NotifyBirthdayObserver } from './domain/NotifyBirthdayObserver'
import { NotifyGuildLeaveObserver } from './domain/NotifyGuildLeaveObserver'
import { NotifyVoiceCallObserver } from './domain/NotifyVoiceCallObserver'
import { SendWelcomeDMObserver } from './domain/SendWelcomeDMObserver'
import { SetDefaultRoleObserver } from './domain/SetDefaultRoleObserver'
import { TextInteractionsObserver } from './domain/TextInteractionsObserver'
import { AdminCommandsObserver } from './domain/commands/AdminCommandsObserver'
import { MusicCommandsObserver } from './domain/commands/MusicCommandsObserver'
import { OtherCommandsObserver } from './domain/commands/OtherCommandsObserver'
import { PollCommandsObserver } from './domain/commands/PollCommandsObserver'
import { DeployCommandsObserver } from './domain/startup/DeployCommandsObserver'
import { IndexesEnsureObserver } from './domain/startup/IndexesEnsureObserver'
import type { DiscordConnector } from './helpers/DiscordConnector'
import { LogMadEventsObserver } from './helpers/LogMadEventsObserver'
import { VoiceStateUpdateTransformer } from './helpers/VoiceStateUpdateTransformer'
import { publishDiscordEvents } from './helpers/publishDiscordEvents'
import { scheduleCronJob } from './helpers/scheduleCronJob'
import { MadEvent } from './models/event/MadEvent'
import type { LoggerGetter } from './models/logger/LoggerType'
import { ObserverWithRefinement } from './models/rx/ObserverWithRefinement'
import { PubSub } from './models/rx/PubSub'
import { PubSubUtils } from './utils/PubSubUtils'

export const Application = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
): IO<void> => {
  const clientId = config.client.id
  const {
    logger,
    ytDlp,
    ensureIndexes,
    botStateService,
    guildStateService,
    pollResponseService,
    memberBirthdateService,
    startWebServer,
  } = Context.of(Logger, config, discord)

  const madEventsPubSub = PubSub<MadEvent>()
  const sub = PubSubUtils.subscribe<MadEvent>(logger, madEventsPubSub.observable)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ domain/
      // │  └ commands/
      sub(AdminCommandsObserver(Logger, discord, botStateService, guildStateService)),
      sub(MusicCommandsObserver(Logger, ytDlp, guildStateService)),
      sub(OtherCommandsObserver()),
      sub(PollCommandsObserver(Logger, clientId, pollResponseService)),
      // │  └ startup/
      sub(DeployCommandsObserver(Logger, config, discord)),
      sub(IndexesEnsureObserver(Logger, madEventsPubSub.subject, ensureIndexes)),
      // │
      sub(ActivityStatusObserver(botStateService)),
      sub(CallsAutoroleObserver(Logger, guildStateService)),
      sub(DisconnectVocalObserver(clientId, guildStateService)),
      sub(ItsFridayObserver(Logger, guildStateService)),
      sub(MusicThreadCleanObserver(Logger, clientId, guildStateService)),
      sub(NotifyBirthdayObserver(discord, guildStateService, memberBirthdateService)),
      sub(NotifyGuildLeaveObserver(Logger)),
      sub(NotifyVoiceCallObserver(Logger, guildStateService)),
      sub(SendWelcomeDMObserver(Logger)),
      sub(SetDefaultRoleObserver(Logger, guildStateService)),
      sub(TextInteractionsObserver(config.captain, discord)),
      // └ helpers/
      sub(ObserverWithRefinement.of(LogMadEventsObserver(logger))),
      publishDiscordEvents(discord, madEventsPubSub.subject),
      scheduleCronJob(Logger, madEventsPubSub.subject),
      sub(VoiceStateUpdateTransformer(Logger, clientId, madEventsPubSub.subject)),
    ),
    IO.chain(() => startWebServer),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
