import { REST } from '@discordjs/rest'
import { ApplicationCommandPermissionData } from 'discord.js'
import { ApplicationCommandPermissionTypes } from 'discord.js/typings/enums'
import { pipe } from 'fp-ts/function'

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

  const permissions: NonEmptyArray<ApplicationCommandPermissionData> = pipe(
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
    next: () => {
      const commands = pipe(
        [...adminCommands, pingObserverCommand, musicObserverCommand],
        List.map(command => command.toJSON()),
      )
      const rest = new REST({ version: '9' }).setToken(config.client.secret)

      return pipe(
        guildStateService.findAll(),
        Future.chain(
          Future.traverseArray(guildId =>
            pipe(
              DiscordConnector.restPutApplicationGuildCommands(
                rest,
                config.client.id,
                guildId,
                commands,
              ),
              Future.chain(({ left, right }) =>
                pipe(
                  left,
                  IO.traverseSeqArray(logger.warn),
                  Future.fromIOEither,
                  Future.map(() => right),
                ),
              ),
              Future.chain(results =>
                pipe(
                  discord.getGuild(guildId),
                  Maybe.fold(
                    () => Future.unit,
                    guild =>
                      pipe(
                        results,
                        List.filter(isAdminCommand),
                        Future.traverseArray(cmd =>
                          pipe(
                            DiscordConnector.fetchCommand(guild, cmd.id),
                            Future.chain(command =>
                              DiscordConnector.commandPermissionsSet(command, permissions),
                            ),
                          ),
                        ),
                        Future.map(() => {}),
                      ),
                  ),
                ),
              ),
              Future.recover(e =>
                pipe(
                  logger.warn(
                    `Failed to deploy commands for guild ${GuildId.unwrap(guildId)}\n${e.stack}`,
                  ),
                  Future.fromIOEither,
                ),
              ),
            ),
          ),
        ),
        Future.chain(() => Future.fromIOEither(logger.info('Ensured commands'))),
      )
    },
  }
}

const isAdminCommand = (command: PutCommandResult): boolean =>
  pipe(
    adminCommands,
    List.exists(cmd => cmd.name === command.name),
  )
