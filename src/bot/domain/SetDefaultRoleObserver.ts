import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { LoggerGetter } from 'bot/models/logger/LoggerType'
import type { GuildMemberAdd } from 'bot/models/MadEvent'
import type { TObserver } from 'bot/models/rx/TObserver'
import type { GuildStateService } from 'bot/services/GuildStateService'
import { LogUtils } from 'bot/utils/LogUtils'
import { pipe } from 'fp-ts/function'
import { Future, Maybe } from 'shared/utils/fp'

export const SetDefaultRoleObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<GuildMemberAdd> => {
  const logger = Logger('SetDefaultRoleObserver')

  return {
    next: event => {
      const member = event.member
      const log = LogUtils.pretty(logger, member.guild)

      return pipe(
        guildStateService.getDefaultRole(member.guild),
        Future.chain(
          Maybe.fold(
            () =>
              Future.fromIOEither(
                log('warn', `No default role stored, couldn't add ${member.user.tag}`),
              ),
            role =>
              pipe(
                DiscordConnector.addRole(member, role),
                Future.map(success =>
                  success
                    ? log('debug', `Added ${member.user.tag} to role @${role.name}`)
                    : log('warn', `Couldn't add ${member.user.tag} to role @${role.name}`),
                ),
                Future.chain(Future.fromIOEither),
              ),
          ),
        ),
      )
    },
  }
}
