import type { MessageOptions } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'

import type { DiscordUserId } from '../../../../shared/models/DiscordUserId'
import { LogLevel } from '../../../../shared/models/LogLevel'
import type { LogEvent } from '../../../../shared/models/event/LogEvent'
import type { TObserver } from '../../../../shared/models/rx/TObserver'
import { StringUtils } from '../../../../shared/utils/StringUtils'
import { Future, NonEmptyArray, toUnit } from '../../../../shared/utils/fp'
import { futureMaybe } from '../../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../../helpers/DiscordConnector'
import { MessageUtils } from '../../../utils/MessageUtils'

type DiscordDMCompact = {
  readonly discordDMIsCompact: boolean
}

export const DiscordDMLogObserver = (
  admins: NonEmptyArray<DiscordUserId>,
  { discordDMIsCompact }: DiscordDMCompact,
  discord: DiscordConnector,
): TObserver<LogEvent> => ({
  next: ({ name, level, message }) => {
    const options: string | MessageOptions = discordDMIsCompact
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
      Future.map(toUnit),
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

const formatDMEmbed = (name: string, level: LogLevel, msg: string): MessageOptions =>
  MessageUtils.singleSafeEmbed({ color: LogLevel.hexColor[level], description: `${name} - ${msg}` })
