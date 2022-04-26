import type { StageChannel, VoiceChannel } from 'discord.js'
import util from 'util'

import type { LoggerType } from '../../shared/models/LoggerType'
import type { TObserver } from '../../shared/models/rx/TObserver'
import { Future } from '../../shared/utils/fp'

import type { MadEvent } from '../models/event/MadEvent'
import { LogUtils } from '../utils/LogUtils'

const { format } = LogUtils

export const LogMadEventObserver = (logger: LoggerType): TObserver<MadEvent> => ({
  next: event => {
    const message = ((): string | undefined => {
      switch (event.type) {
        case 'AppStarted':
          return ''

        case 'CronJob':
          return

        case 'InteractionCreate':
          return `${format(
            event.interaction.guild,
            event.interaction.user,
            event.interaction.channel,
          )} ${
            event.interaction.isCommand()
              ? event.interaction
              : event.interaction.isButton()
              ? `Button("${event.interaction.customId}")`
              : util.formatWithOptions({ breakLength: Infinity }, { type: event.interaction.type })
          }`

        case 'GuildMemberAdd':
        case 'GuildMemberRemove':
          return `${format(event.member.guild)} ${event.member.user.tag}`

        case 'VoiceStateUpdate':
          return `${format(
            event.oldState.guild,
            event.oldState.member?.user ?? event.newState.member?.user,
          )} ${maybeChannel(event.oldState.channel)} > ${maybeChannel(event.newState.channel)}`

        case 'PublicCallStarted':
        case 'PublicCallEnded':
          return format(event.channel.guild, event.member.user, event.channel)

        case 'MessageCreate':
          return `${format(event.message.guild, event.message.author, event.message.channel)} ${
            event.message.content
          }`

        case 'MessageDelete':
          return `${format(event.messages[0]?.guild, null, event.messages[0]?.channel)} ${
            event.messages.length
          } message${event.messages.length < 2 ? '' : 's'}`
      }
    })()
    if (message !== undefined) return Future.fromIOEither(logger.info('✉️ ', event.type, message))
    return Future.unit
  },
})

const maybeChannel = (channel: VoiceChannel | StageChannel | null): string =>
  channel === null ? 'null' : `#${channel.name}`
