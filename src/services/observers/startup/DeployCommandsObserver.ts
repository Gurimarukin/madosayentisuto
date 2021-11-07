import { REST } from '@discordjs/rest'
import { ApplicationCommandPermissionData, ApplicationCommandPermissions, Guild } from 'discord.js'
import { ApplicationCommandPermissionTypes } from 'discord.js/typings/enums'
import { pipe } from 'fp-ts/function'
import { Separated } from 'fp-ts/Separated'

import { Config } from '../../../config/Config'
import { GuildId } from '../../../models/GuildId'
import { DbReady } from '../../../models/MadEvent'
import { PutCommandResult } from '../../../models/PutCommandResult'
import { TObserver } from '../../../models/TObserver'
import { TSnowflake } from '../../../models/TSnowflake'
import { Future, IO, List, Maybe, NonEmptyArray } from '../../../utils/fp'
import { DiscordConnector } from '../../DiscordConnector'
import { GuildStateService } from '../../GuildStateService'
import { PartialLogger } from '../../Logger'
import { adminCommands } from '../commands/AdminCommandsObserver'
import { musicObserverCommand } from '../commands/MusicObserver'
import { pingObserverCommand } from '../commands/PingObserver'

export const DeployCommandsObserver = (
  Logger: PartialLogger,
  config: Config,
  discord: DiscordConnector,
  guildStateService: GuildStateService,
): TObserver<DbReady> => {
  const logger = Logger('DeployCommandsObserver')

  const rest = new REST({ version: '9' }).setToken(config.client.secret)

  const commands = pipe(
    [...adminCommands, pingObserverCommand, musicObserverCommand],
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
      Future.recover(e =>
        pipe(
          logger.warn(`Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`),
          Future.fromIOEither,
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
        Maybe.fold(
          () => Future.unit,
          guild =>
            pipe(
              results,
              List.filter(isAdminCommand),
              Future.traverseArray(fetchCommandAndSetPermissions(guild)),
              Future.map(() => {}),
            ),
        ),
      )
  }

  function fetchCommandAndSetPermissions(
    guild: Guild,
  ): (cmd: PutCommandResult) => Future<List<ApplicationCommandPermissions>> {
    return cmd =>
      pipe(
        DiscordConnector.fetchCommand(guild, cmd.id),
        Future.chain(command => DiscordConnector.commandPermissionsSet(command, adminsPermissions)),
      )
  }
}

const isAdminCommand = (command: PutCommandResult): boolean =>
  pipe(
    adminCommands,
    List.exists(cmd => cmd.name === command.name),
  )