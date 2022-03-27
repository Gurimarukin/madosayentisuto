import { REST } from '@discordjs/rest'
import type {
  ApplicationCommandPermissionData,
  Guild,
  GuildApplicationCommandPermissionData,
} from 'discord.js'
import type { Separated } from 'fp-ts/Separated'
import { pipe } from 'fp-ts/function'

import { GuildId } from '../../../shared/models/guild/GuildId'
import { UserId } from '../../../shared/models/guild/UserId'
import { Future, IO, List, NonEmptyArray, toUnit } from '../../../shared/utils/fp'

import type { Config } from '../../Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { CommandId } from '../../models/command/CommandId'
import type { PutCommandResult } from '../../models/command/PutCommandResult'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import { adminCommands } from '../commands/AdminCommandsObserver'
import { musicCommands } from '../commands/MusicCommandsObserver'
import { otherCommands } from '../commands/OtherCommandsObserver'
import { pollCommands } from '../commands/PollCommandsObserver'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
) => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST({ version: '9' }).setToken(config.client.secret)

  const commands = List.flatten([adminCommands, musicCommands, otherCommands, pollCommands])

  const adminsPermissions: NonEmptyArray<ApplicationCommandPermissionData> = pipe(
    config.admins,
    NonEmptyArray.map(
      (id): ApplicationCommandPermissionData => ({
        id: UserId.unwrap(id),
        type: 2, // ApplicationCommandPermissionTypes.USER
        permission: true,
      }),
    ),
  )

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'DbReady',
  )(() =>
    pipe(
      Future.fromIOEither(discord.listGuilds),
      Future.chain(Future.traverseArray(putCommandsForGuild)),
      Future.chainIOEitherK(() => logger.info('Ensured commands')),
    ),
  )

  function putCommandsForGuild(guild: Guild): Future<void> {
    const guildId = GuildId.wrap(guild.id)
    return pipe(
      DiscordConnector.restPutApplicationGuildCommands(rest, config.client.id, guildId, commands),
      Future.chain(logDecodeErrors),
      Future.chain(guildCommandsPermissionsSet(guild)),
      Future.orElseIOEitherK(e =>
        logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
      ),
    )
  }

  function logDecodeErrors({
    left,
    right,
  }: Separated<List<Error>, List<PutCommandResult>>): Future<List<PutCommandResult>> {
    return pipe(
      left,
      IO.traverseSeqArray(logger.warn),
      Future.fromIOEither,
      Future.map(() => right),
    )
  }

  function guildCommandsPermissionsSet(
    guild: Guild,
  ): (results: List<PutCommandResult>) => Future<void> {
    return results =>
      pipe(
        DiscordConnector.guildCommandsPermissionsSet(guild, getFullPermission(results)),
        Future.map(toUnit),
      )
  }

  function getFullPermission(
    results: List<PutCommandResult>,
  ): List<GuildApplicationCommandPermissionData> {
    return pipe(
      results,
      List.filter(isAdminCommand),
      List.map(
        (cmd): GuildApplicationCommandPermissionData => ({
          id: CommandId.unwrap(cmd.id),
          // eslint-disable-next-line functional/prefer-readonly-type
          permissions: adminsPermissions as unknown as ApplicationCommandPermissionData[],
        }),
      ),
    )
  }
}

const isAdminCommand = (command: PutCommandResult): boolean =>
  pipe(
    adminCommands,
    List.exists(cmd => cmd.name === command.name),
  )
