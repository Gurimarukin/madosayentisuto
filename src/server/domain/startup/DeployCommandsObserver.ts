import { REST } from '@discordjs/rest'
import type { Guild } from 'discord.js'
import { ApplicationCommandPermissionType } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future, List, NonEmptyArray, toNotUsed } from '../../../shared/utils/fp'

import type { Config } from '../../config/Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { CommandId } from '../../models/command/CommandId'
import type { Command, GuildCommand } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
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

const { left: globalCommands, right: guildCommands } = pipe(
  commands,
  List.partitionMap(command => {
    switch (command._tag) {
      case 'Global':
        return Either.left(command)
      case 'Guild':
        return Either.right(command)
    }
  }),
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
) => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST().setToken(config.client.secret)

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
        DiscordConnector.restPutApplicationCommands(rest, config.client.id),
        Future.map(toNotUsed),
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
        Future.chain(List.traverse(Future.ApplicativePar)(putCommandsForGuild(guildCommands))),
        Future.chainIOEitherK(() => logger.debug('Deployed guild commands')),
      )
    }
    return Future.fromIOEither(logger.debug('No guild commands to deploy'))
  }

  function putCommandsForGuild(
    guildCommands_: NonEmptyArray<GuildCommand>,
  ): (guild: Guild) => Future<NotUsed> {
    return guild => {
      const guildId = GuildId.fromGuild(guild)
      return pipe(
        DiscordConnector.restPutApplicationGuildCommands(
          rest,
          config.client.id,
          guildId,
        )(guildCommands_),
        Future.chain(
          flow(
            List.zip(guildCommands_),
            List.traverse(Future.ApplicativePar)(([commandResult, guildCommand]) =>
              guildCommand.isAdmin
                ? restPutApplicationCommandPermissions(guildId, commandResult.id)
                : Future.notUsed,
            ),
          ),
        ),
        Future.map(toNotUsed),
        Future.orElseIOEitherK(e =>
          logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
        ),
      )
    }
  }

  function restPutApplicationCommandPermissions(
    guildId: GuildId,
    commandId: CommandId,
  ): Future<NotUsed> {
    return pipe(
      DiscordConnector.restPutApplicationCommandPermissions(
        rest,
        config.client.id,
        guildId,
        commandId,
      )([
        {
          id: CommandId.unwrap(commandId),
          permissions: pipe(
            config.admins,
            NonEmptyArray.map(adminId => ({
              id: DiscordUserId.unwrap(adminId),
              type: ApplicationCommandPermissionType.User,
              permission: true,
            })),
            NonEmptyArray.asMutable,
          ),
        },
      ]),
      Future.map(toNotUsed),
    )
  }
}
