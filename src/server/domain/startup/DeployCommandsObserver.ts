import type { Guild } from 'discord.js'
import { REST } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { GuildId } from '../../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Future, List, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'

import type { Config } from '../../config/Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { BotToken } from '../../models/discord/BotToken'
import type { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import { utilInspect } from '../../utils/utilInspect'
import { adminCommands } from '../commands/AdminCommandsObserver'
import { musicCommands } from '../commands/MusicCommandsObserver'
import { otherCommands } from '../commands/OtherCommandsObserver'
import { pollCommands } from '../commands/PollCommandsObserver'
import { remindCommands } from '../commands/RemindCommandsObserver'

const commands = List.flatten<Command>([
  adminCommands,
  musicCommands,
  otherCommands,
  pollCommands,
  remindCommands,
])

const { left: guildCommands, right: globalCommands } = pipe(
  commands,
  List.partition(command => command.isGlobal),
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
) => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST().setToken(BotToken.unwrap(config.client.token))

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
    if (!List.isNonEmpty(globalCommands)) {
      return Future.fromIOEither(logger.debug('No global commands to deploy'))
    }
    return pipe(
      globalCommands,
      NonEmptyArray.map(command => command.value),
      DiscordConnector.restPutApplicationCommands(rest, config.client.id),
      Future.map(toNotUsed),
      Future.orElseIOEitherK(e =>
        logger.warn(`Failed to deploy global commands\n${utilInspect(e)}`),
      ),
      Future.chainIOEitherK(() => logger.debug('Deployed global commands')),
    )
  }

  function deployGuildCommands(): Future<NotUsed> {
    if (!List.isNonEmpty(guildCommands)) {
      return Future.fromIOEither(logger.debug('No guild commands to deploy'))
    }
    return pipe(
      Future.fromIOEither(discord.listGuilds),
      Future.chain(List.traverse(Future.ApplicativeSeq)(putCommandsForGuild(guildCommands))),
      Future.chainIOEitherK(() => logger.debug('Deployed guild commands')),
    )
  }

  function putCommandsForGuild(
    guildCommands_: NonEmptyArray<Command>,
  ): (guild: Guild) => Future<NotUsed> {
    return guild => {
      const guildId = GuildId.fromGuild(guild)
      return pipe(
        guildCommands_,
        NonEmptyArray.map(command => command.value),
        DiscordConnector.restPutApplicationGuildCommands(rest, config.client.id, guildId),
        Future.map(toNotUsed),
        Future.orElseIOEitherK(e =>
          logger.warn(
            `Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${utilInspect(e)}`,
          ),
        ),
      )
    }
  }
}
