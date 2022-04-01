import { pipe } from 'fp-ts/function'

import { Future } from '../../shared/utils/fp'
import { futureMaybe } from '../../shared/utils/futureMaybe'

import { DiscordConnector } from '../helpers/DiscordConnector'
import { MadEvent } from '../models/event/MadEvent'
import type { LoggerGetter } from '../models/logger/LoggerGetter'
import { ObserverWithRefinement } from '../models/rx/ObserverWithRefinement'
import type { GuildStateService } from '../services/GuildStateService'
import { LogUtils } from '../utils/LogUtils'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const SetDefaultRoleObserver = (
  Logger: LoggerGetter,
  guildStateService: GuildStateService,
) => {
  const logger = Logger('SetDefaultRoleObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'GuildMemberAdd',
  )(event => {
    const member = event.member
    const log = LogUtils.pretty(logger, member.guild)

    return pipe(
      guildStateService.getDefaultRole(member.guild),
      futureMaybe.matchE(
        () =>
          Future.fromIOEither(log.info(`No default role stored, couldn't add ${member.user.tag}`)),
        role =>
          pipe(
            DiscordConnector.roleAdd(member, role),
            Future.map(success =>
              success
                ? log.info(`Added ${member.user.tag} to role @${role.name}`)
                : log.warn(`Couldn't add ${member.user.tag} to role @${role.name}`),
            ),
            Future.chain(Future.fromIOEither),
          ),
      ),
    )
  })
}
