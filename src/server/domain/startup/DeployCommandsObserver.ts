import { REST } from '@discordjs/rest'
import type { Guild } from 'discord.js'
import type { Separated } from 'fp-ts/Separated'
import { pipe } from 'fp-ts/function'

import { GuildId } from '../../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Future, IO, List, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'

import type { ClientConfig } from '../../config/Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { Command } from '../../models/discord/Command'
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

  const rest = new REST().setToken(config.secret)

  const { right: globalCommands, left: guildCommands } = pipe(
    [adminCommands, musicCommands, otherCommands, pollCommands, remindCommands],
    List.flatten,
    List.partition(cmd => cmd.isGlobal),
  )

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'AppStarted',
  )(() =>
    pipe(
      deployGlobalCommands(),
      Future.chain(deployGuildCommands),
      Future.chainIOEitherK(() => logger.info('Deployed commands')),
    ),
  )

  function deployGlobalCommands(): Future<NotUsed> {
    if (List.isNonEmpty(globalCommands)) {
      return pipe(
        globalCommands,
        NonEmptyArray.map(command => command.value),
        DiscordConnector.restPutApplicationCommands(rest, config.id),
        Future.chain(logDecodeErrors),
        Future.orElseIOEitherK(e => logger.warn(`Failed to deploy global commands\n${e.stack}`)),
        Future.chainIOEitherK(() => logger.debug('Deployed global commands')),
      )
    }
    return Future.fromIOEither(logger.debug('No global commands to deploy'))
  }

  function deployGuildCommands(): Future<NotUsed> {
    if (List.isNonEmpty(guildCommands)) {
      return pipe(
        Future.fromIOEither(discord.listGuilds),
        Future.chain(Future.traverseArray(putCommandsForGuild(guildCommands))),
        Future.chainIOEitherK(() => logger.debug('Deployed guild commands')),
      )
    }
    return Future.fromIOEither(logger.debug('No guild commands to deploy'))
  }

  function putCommandsForGuild(
    guildCommands_: NonEmptyArray<Command>,
  ): (guild: Guild) => Future<NotUsed> {
    return guild => {
      const guildId = GuildId.fromGuild(guild)
      return pipe(
        guildCommands_,
        NonEmptyArray.map(command => command.value),
        DiscordConnector.restPutApplicationGuildCommands(rest, config.id, guildId),
        Future.chain(logDecodeErrors),
        Future.orElseIOEitherK(e =>
          logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
        ),
      )
    }
  }

  function logDecodeErrors({ left }: Separated<List<Error>, unknown>): Future<NotUsed> {
    return pipe(
      left,
      IO.traverseSeqArray(e => logger.warn(e.message)),
      Future.fromIOEither,
      Future.map(toNotUsed),
    )
  }
}
