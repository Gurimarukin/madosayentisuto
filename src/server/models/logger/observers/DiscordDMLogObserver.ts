import type { BaseMessageOptions } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import type { DiscordUserId } from '../../../../shared/models/DiscordUserId'
import type { LogEvent } from '../../../../shared/models/event/LogEvent'
import { LogLevel } from '../../../../shared/models/log/LogLevel'
import type { TObserver } from '../../../../shared/models/rx/TObserver'
import { StringUtils } from '../../../../shared/utils/StringUtils'
import { Future, NonEmptyArray, toNotUsed } from '../../../../shared/utils/fp'
import { futureMaybe } from '../../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../../helpers/DiscordConnector'
import { MessageComponent } from '../../discord/MessageComponent'

type DiscordDMCompact = {
  discordDMIsCompact: boolean
}

export const DiscordDMLogObserver = (
  admins: NonEmptyArray<DiscordUserId>,
  { discordDMIsCompact }: DiscordDMCompact,
  discord: DiscordConnector,
): TObserver<LogEvent> => ({
  next: ({ name, level, message }) => {
    const options: string | BaseMessageOptions = discordDMIsCompact
      ? formatDMCompact(name, level, message)
      : formatDMEmbed(name, level, message)
    return pipe(
      admins,
      NonEmptyArray.traverse(Future.ApplicativePar)(
        flow(
          discord.fetchUser,
          futureMaybe.chain(user => DiscordConnector.sendMessage(user, options)),
        ),
      ),
      Future.map(toNotUsed),
    )
  },
})

const formatDMCompact = (name: string, level: LogLevel, msg: string): string => {
  const withName = `${name} - ${msg}`
  const res =
    level === 'info' || level === 'warn'
      ? `\`${level.toUpperCase()}  ${withName}\``
      : `\`${level.toUpperCase()} ${withName}\``
  return pipe(res, StringUtils.ellipse(2000))
}

const formatDMEmbed = (name: string, level: LogLevel, msg: string): BaseMessageOptions =>
  MessageComponent.singleSafeEmbed({
    color: LogLevel.hexColor[level],
    description: `${name} - ${msg}`,
  })
