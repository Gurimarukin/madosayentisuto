import { REST } from '@discordjs/rest'
import type {
  ApplicationCommandPermissionData,
  Guild,
  GuildApplicationCommandPermissionData,
} from 'discord.js'
import { ApplicationCommandPermissionTypes } from 'discord.js/typings/enums'
import type { Separated } from 'fp-ts/Separated'
import { pipe } from 'fp-ts/function'

import { Future, IO, List, Maybe, NonEmptyArray } from 'shared/utils/fp'

import type { Config } from 'bot/Config'
import { adminCommands } from 'bot/domain/commands/AdminCommandsObserver'
import { playCommand } from 'bot/domain/commands/MusicCommandsObserver'
import { pingCommand } from 'bot/domain/commands/PingCommandObserver'
import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import { GuildId } from 'bot/models/GuildId'
import type { DbReady } from 'bot/models/MadEvent'
import { TSnowflake } from 'bot/models/TSnowflake'
import { CommandId } from 'bot/models/commands/CommandId'
import type { PutCommandResult } from 'bot/models/commands/PutCommandResult'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { GuildStateService } from 'bot/services/GuildStateService'

export const DeployCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
  guildStateService: GuildStateService,
): TObserver<DbReady> => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST({ version: '9' }).setToken(config.client.secret)

  const commands = pipe(
    [...adminCommands, pingCommand, playCommand],
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
        guildStateService.findAll(),
        Future.chain(Future.traverseArray(putCommandsForGuild)),
        Future.chain(() => Future.fromIOEither(logger.info('Ensured commands'))),
      ),
  }

  function putCommandsForGuild(guildId: GuildId): Future<void> {
    return pipe(
      DiscordConnector.restPutApplicationGuildCommands(rest, config.client.id, guildId, commands),
      Future.chain(logDecodeErrors),
      Future.chain(setCommandsPermissions(guildId)),
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

  function setCommandsPermissions(
    guildId: GuildId,
  ): (results: List<PutCommandResult>) => Future<void> {
    return results =>
      pipe(
        discord.getGuild(guildId),
        Maybe.fold(() => Future.unit, guildCommandsPermissionsSet(results)),
      )
  }

  function guildCommandsPermissionsSet(
    results: List<PutCommandResult>,
  ): (guild: Guild) => Future<void> {
    return guild =>
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
