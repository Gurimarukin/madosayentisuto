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
import { MadEvent } from './models/events/MadEvent'
import type { LoggerGetter } from './models/logger/LoggerType'
import { PubSub } from './models/rx/PubSub'
import { PubSubUtils } from './utils/PubSubUtils'

const { or } = PubSubUtils

export const Application = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
): IO<void> => {
  const { logger, ytDlp, ensureIndexes, botStateService, guildStateService, startWebServer } =
    Context.of(Logger, config, discord)

  const madEventsPubSub = PubSub<MadEvent>()
  const sub = PubSubUtils.subscribe(logger, madEventsPubSub.observable)

  return pipe(
    apply.sequenceT(IO.ApplyPar)(
      // └ domain/
      // │  └ commands/
      sub(
        AdminCommandsObserver(Logger, discord, botStateService, guildStateService),
        or(MadEvent.is('InteractionCreate')),
      ),
      sub(
        MusicCommandsObserver(Logger, ytDlp, guildStateService),
        or(MadEvent.is('InteractionCreate')),
      ),
      sub(OtherCommandsObserver(), or(MadEvent.is('InteractionCreate'))),
      sub(
        PollCommandsObserver(),
        or(MadEvent.is('InteractionCreate'), MadEvent.is('MessageDelete')),
      ),

      // │  └ startup/
      sub(
        DeployCommandsObserver(Logger, config, discord, guildStateService),
        or(MadEvent.is('DbReady')),
      ),
      sub(
        IndexesEnsureObserver(Logger, madEventsPubSub.subject, ensureIndexes),
        or(MadEvent.is('AppStarted')),
      ),

      // │
      sub(
        ActivityStatusObserver(botStateService),
        or(MadEvent.is('AppStarted'), MadEvent.is('DbReady'), MadEvent.is('CronJob')),
      ),
      sub(CallsAutoroleObserver(Logger, guildStateService), or(MadEvent.is('InteractionCreate'))),
      sub(
        DisconnectVocalObserver(config.client.id, guildStateService),
        or(MadEvent.is('VoiceStateUpdate')),
      ),
      sub(ItsFridayObserver(Logger, guildStateService), or(MadEvent.is('CronJob'))),
      sub(
        MusicThreadCleanObserver(Logger, config.client.id, guildStateService),
        or(MadEvent.is('MessageCreate')),
      ),
      sub(NotifyGuildLeaveObserver(Logger), or(MadEvent.is('GuildMemberRemove'))),
      sub(
        NotifyVoiceCallObserver(Logger, guildStateService),
        or(MadEvent.is('PublicCallStarted'), MadEvent.is('PublicCallEnded')),
      ),
      sub(SendWelcomeDMObserver(Logger), or(MadEvent.is('GuildMemberAdd'))),
      sub(SetDefaultRoleObserver(Logger, guildStateService), or(MadEvent.is('GuildMemberAdd'))),
      sub(TextInteractionsObserver(config.captain, discord), or(MadEvent.is('MessageCreate'))),

      // └ helpers/
      sub(LogMadEventsObserver(logger), or(refinement.id())),
      publishDiscordEvents(discord, madEventsPubSub.subject),
      scheduleCronJob(Logger, madEventsPubSub.subject),
      sub(
        VoiceStateUpdateTransformer(Logger, config.client.id, madEventsPubSub.subject),
        or(MadEvent.is('VoiceStateUpdate')),
      ),
    ),
    IO.chain(() => startWebServer),
    IO.chain(() => madEventsPubSub.subject.next(MadEvent.AppStarted())),
    IO.chain(() => logger.info('Started')),
  )
}
