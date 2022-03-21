import { apply, refinement } from 'fp-ts'
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
import { PubSub } from './models/rx/PubSub'
import { PubSubUtils } from './utils/PubSubUtils'

const { or } = PubSubUtils

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
  const sub = PubSubUtils.subscribe(logger, madEventsPubSub.observable)

  const adminCommandsObserver = AdminCommandsObserver(
    Logger,
    discord,
    botStateService,
    guildStateService,
  )
  // └ domain/
  // │  └ commands/
  const musicCommandsObserver = MusicCommandsObserver(Logger, ytDlp, guildStateService)
  const otherCommandsObserver = OtherCommandsObserver()
  const pollCommandsObserver = PollCommandsObserver(Logger, clientId, pollResponseService)
  // │  └ startup/
  const deployCommandsObserver = DeployCommandsObserver(Logger, config, discord)
  const indexesEnsureObserver = IndexesEnsureObserver(
    Logger,
    madEventsPubSub.subject,
    ensureIndexes,
  )
  // │
  const activityStatusObserver = ActivityStatusObserver(botStateService)
  const callsAutoroleObserver = CallsAutoroleObserver(Logger, guildStateService)
  const disconnectVocalObserver = DisconnectVocalObserver(clientId, guildStateService)
  const itsFridayObserver = ItsFridayObserver(Logger, guildStateService)
  const musicThreadCleanObserver = MusicThreadCleanObserver(Logger, clientId, guildStateService)
  const notifyBirthdayObserver = NotifyBirthdayObserver(
    discord,
    guildStateService,
    memberBirthdateService,
  )
  const notifyGuildLeaveObserver = NotifyGuildLeaveObserver(Logger)
  const notifyVoiceCallObserver = NotifyVoiceCallObserver(Logger, guildStateService)
  const sendWelcomeDMObserver = SendWelcomeDMObserver(Logger)
  const setDefaultRoleObserver = SetDefaultRoleObserver(Logger, guildStateService)
  const textInteractionsObserver = TextInteractionsObserver(config.captain, discord)
  // └ helpers/
  const logMadEventsObserver = LogMadEventsObserver(logger)
  const voiceStateUpdateTransformer = VoiceStateUpdateTransformer(
    Logger,
    clientId,
    madEventsPubSub.subject,
  )

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ domain/
      // │  └ commands/
      sub(adminCommandsObserver, or(MadEvent.is('InteractionCreate'))),
      sub(musicCommandsObserver, or(MadEvent.is('InteractionCreate'))),
      sub(otherCommandsObserver, or(MadEvent.is('InteractionCreate'))),
      sub(pollCommandsObserver, or(MadEvent.is('InteractionCreate'), MadEvent.is('MessageDelete'))),
      // │  └ startup/
      sub(deployCommandsObserver, or(MadEvent.is('DbReady'))),
      sub(indexesEnsureObserver, or(MadEvent.is('AppStarted'))),
      // │
      sub(
        activityStatusObserver,
        or(MadEvent.is('AppStarted'), MadEvent.is('DbReady'), MadEvent.is('CronJob')),
      ),
      sub(callsAutoroleObserver, or(MadEvent.is('InteractionCreate'))),
      sub(disconnectVocalObserver, or(MadEvent.is('VoiceStateUpdate'))),
      sub(itsFridayObserver, or(MadEvent.is('CronJob'))),
      sub(musicThreadCleanObserver, or(MadEvent.is('MessageCreate'))),
      sub(notifyBirthdayObserver, or(MadEvent.is('CronJob'))),
      sub(notifyGuildLeaveObserver, or(MadEvent.is('GuildMemberRemove'))),
      sub(
        notifyVoiceCallObserver,
        or(MadEvent.is('PublicCallStarted'), MadEvent.is('PublicCallEnded')),
      ),
      sub(sendWelcomeDMObserver, or(MadEvent.is('GuildMemberAdd'))),
      sub(setDefaultRoleObserver, or(MadEvent.is('GuildMemberAdd'))),
      sub(textInteractionsObserver, or(MadEvent.is('MessageCreate'))),
      // └ helpers/
      sub(logMadEventsObserver, or(refinement.id())),
      publishDiscordEvents(discord, madEventsPubSub.subject),
      scheduleCronJob(Logger, madEventsPubSub.subject),
      sub(voiceStateUpdateTransformer, or(MadEvent.is('VoiceStateUpdate'))),
    ),
    IO.chain(() => startWebServer),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
