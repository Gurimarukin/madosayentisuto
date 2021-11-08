import util from 'util'

import { StageChannel, VoiceChannel } from 'discord.js'

import { MadEvent } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { Future } from '../../utils/fp'
import { LogUtils } from '../../utils/LogUtils'
import { Logger } from '../Logger'

const { format } = LogUtils

export const LogMadEventsObserver = (logger: Logger): TObserver<MadEvent> => ({
  next: event => {
    const message = ((): string => {
      switch (event.type) {
        case 'AppStarted':
        case 'DbReady':
        case 'CronJob':
          return ''

        case 'InteractionCreate':
          return `${format(
            event.interaction.guild,
            event.interaction.channel,
            event.interaction.user,
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
            null,
            event.oldState.member?.user ?? event.newState.member?.user,
          )} ${maybeChannel(event.oldState.channel)} > ${maybeChannel(event.newState.channel)}`

        case 'PublicCallStarted':
        case 'PublicCallEnded':
          return `${format(event.channel.guild, event.channel)} ${event.member.user.tag}`

        case 'MessageCreate':
          return `${format(event.message.guild, event.message.channel, event.message.author)} ${
            event.message.content
          }`
      }
    })()
    return Future.fromIOEither(logger.debug('✉️ ', event.type, message))
  },
})

const maybeChannel = (channel: VoiceChannel | StageChannel | null): string =>
  channel === null ? 'null' : `#${channel.name}`
