import { REST } from '@discordjs/rest'
import type {
  ApplicationCommandPermissionData,
  Guild,
  GuildApplicationCommandPermissionData,
} from 'discord.js'
import { ApplicationCommandPermissionTypes } from 'discord.js/typings/enums'
import type { Separated } from 'fp-ts/Separated'
import { pipe } from 'fp-ts/function'

import { GuildId } from '../../../shared/models/guild/GuildId'
import { Future, IO, List, NonEmptyArray } from '../../../shared/utils/fp'

import type { Config } from '../../Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { TSnowflake } from '../../models/TSnowflake'
import { CommandId } from '../../models/commands/CommandId'
import type { PutCommandResult } from '../../models/commands/PutCommandResult'
import type { MadEventDbReady } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import { adminCommands } from '../commands/AdminCommandsObserver'
import { playCommand } from '../commands/MusicCommandsObserver'
import { otherCommands } from '../commands/OtherCommandsObserver'
import { pollCommand } from '../commands/PollCommandsObserver'

export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
): TObserver<MadEventDbReady> => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST({ version: '9' }).setToken(config.client.secret)

  const commands = pipe(
    [...adminCommands, playCommand, ...otherCommands, pollCommand],
    List.map(command => command.toJSON()),
  )

  const adminsPermissions: NonEmptyArray<ApplicationCommandPermissionData> = pipe(
    config.admins,
    NonEmptyArray.map(
      (id): ApplicationCommandPermissionData => ({
        id: TSnowflake.unwrap(id),
        type: ApplicationCommandPermissionTypes.USER,
        permission: true,
      }),
    ),
  )

  return {
    next: () =>
      pipe(
        Future.fromIOEither(discord.getGuilds),
        Future.chain(Future.traverseArray(putCommandsForGuild)),
        Future.chainIOEitherK(() => logger.info('Ensured commands')),
      ),
  }

  function putCommandsForGuild(guild: Guild): Future<void> {
    const guildId = GuildId.wrap(guild.id)
    return pipe(
      DiscordConnector.restPutApplicationGuildCommands(rest, config.client.id, guildId, commands),
      Future.chain(logDecodeErrors),
      Future.chain(guildCommandsPermissionsSet(guild)),
      Future.orElse(e =>
        Future.fromIOEither(
          logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
        ),
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
        Future.map(() => {}),
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
