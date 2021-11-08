import { pipe } from 'fp-ts/function'

import { GuildMemberAdd } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future, Maybe } from '../../../utils/fp'
import { LogUtils } from '../../../utils/LogUtils'
import { DiscordConnector } from '../../DiscordConnector'
import { GuildStateService } from '../../GuildStateService'
import { PartialLogger } from '../../Logger'

export const SetDefaultRoleObserver = (
  Logger: PartialLogger,
  guildStateService: GuildStateService,
): TObserver<GuildMemberAdd> => {
  const logger = Logger('SetDefaultRoleObserver')

  return {
    next: event => {
      const member = event.member
      return pipe(
        guildStateService.getDefaultRole(member.guild),
        Future.chain(
          Maybe.fold(
            () =>
              Future.fromIOEither(
                LogUtils.withGuild(
                  logger,
                  'warn',
                  member.guild,
                )(`No role stored - couldn't add ${member.user.tag}`),
              ),
            role =>
              pipe(
                DiscordConnector.addRole(member, role),
                Future.chain(v =>
                  pipe(
                    v,
                    Maybe.fold(
                      () =>
                        LogUtils.withGuild(
                          logger,
                          'warn',
                          member.guild,
                        )(`Couldn't add ${member.user.tag} to role "${role.name}"`),
                      () =>
                        LogUtils.withGuild(
                          logger,
                          'debug',
                          member.guild,
                        )(`Added user ${member.user.tag} to role "${role.name}"`),
                    ),
                    Future.fromIOEither,
                  ),
                ),
              ),
          ),
        ),
      )
    },
  }
}
