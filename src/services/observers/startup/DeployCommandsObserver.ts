import { REST } from '@discordjs/rest'
import { Routes } from 'discord-api-types/v9'
import { pipe } from 'fp-ts/function'

import { ClientConfig } from '../../../config/Config'
import { GuildId } from '../../../models/GuildId'
import { DbReady } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future, List } from '../../../utils/fp'
import { GuildStateService } from '../../GuildStateService'
import { PartialLogger } from '../../Logger'
import { pingObserverCommand } from '../commands/PingObserver'

export const DeployCommandsObserver = (
  config: ClientConfig,
  Logger: PartialLogger,
  guildStateService: GuildStateService,
): TObserver<DbReady> => {
  const logger = Logger('DeployCommandsObserver')

  return {
    next: () => {
      const commands = pipe(
        [pingObserverCommand],
        List.map(command => command.toJSON()),
      )

      const rest = new REST({ version: '9' }).setToken(config.secret)

      return pipe(
        guildStateService.findAll(),
        Future.chain(
          Future.traverseArray(guildId =>
            pipe(
              Future.tryCatch(() =>
                rest.put(Routes.applicationGuildCommands(config.id, GuildId.unwrap(guildId)), {
                  body: commands,
                }),
              ),
              Future.map(() => {}),
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
