import { pipe } from 'fp-ts/function'

import { Future, Maybe } from '../../shared/utils/fp'

import { DiscordConnector } from '../helpers/DiscordConnector'
import type { MadEventGuildMemberAdd } from '../models/events/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerType'
import type { TObserver } from '../models/rx/TObserver'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

export const SetDefaultRoleObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
): TObserver<MadEventGuildMemberAdd> => {
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
