import { REST } from '@discordjs/rest'
import type { Guild } from 'discord.js'
import type { Separated } from 'fp-ts/Separated'
import { pipe } from 'fp-ts/function'

import { GuildId } from '../../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, List, toUnit } from '../../../shared/utils/fp'

import type { ClientConfig } from '../../Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { PutCommandResult } from '../../models/command/PutCommandResult'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import { adminCommands } from '../commands/AdminCommandsObserver'
import { musicCommands } from '../commands/MusicCommandsObserver'
import { otherCommands } from '../commands/OtherCommandsObserver'
import { pollCommands } from '../commands/PollCommandsObserver'
import { remindCommands } from '../commands/RemindCommandsObserver'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: ClientConfig,
  discord: DiscordConnector,
) => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST({ version: '9' }).setToken(config.secret)

  const commands = List.flatten([
    adminCommands,
    musicCommands,
    otherCommands,
    pollCommands,
    remindCommands,
  ])

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
  )(() =>
    pipe(
      Future.fromIOEither(discord.listGuilds),
      Future.chain(Future.traverseArray(putCommandsForGuild)),
      Future.chainIOEitherK(() => logger.info('Ensured commands')),
    ),
  )

  function putCommandsForGuild(guild: Guild): Future<void> {
    const guildId = GuildId.fromGuild(guild)
    return pipe(
      DiscordConnector.restPutApplicationGuildCommands(rest, config.id, guildId, commands),
      Future.chain(logDecodeErrors),
      Future.orElseIOEitherK(e =>
        logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
      ),
    )
  }

  function logDecodeErrors({ left }: Separated<List<Error>, List<PutCommandResult>>): Future<void> {
    return pipe(
      left,
      IO.traverseSeqArray(e => logger.warn(e.message)),
      Future.fromIOEither,
      Future.map(toUnit),
    )
  }
}
