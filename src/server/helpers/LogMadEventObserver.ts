import type { LoggerType } from '../../shared/models/LoggerType'
import type { TObserver } from '../../shared/models/rx/TObserver'
import { Future } from '../../shared/utils/fp'

import type { MadEvent } from '../models/event/MadEvent'
import type { GuildAudioChannel } from '../utils/ChannelUtils'
import { LogUtils } from '../utils/LogUtils'
import { utilInspect } from '../utils/utilInspect'

const { format } = LogUtils

export const LogMadEventObserver = (logger: LoggerType): TObserver<MadEvent> => ({
  next: event => {
    const message = ((): string | null => {
      switch (event.type) {
        case 'AppStarted':
          return ''

        case 'CronJob':
          return null

        case 'InteractionCreate':
          return `${format(
            event.interaction.guild,
            event.interaction.user,
            event.interaction.channel,
          )} ${
            event.interaction.isChatInputCommand()
              ? event.interaction
              : event.interaction.isButton()
                ? `Button("${event.interaction.customId}")`
                : utilInspect({ type: event.interaction.type }, { breakLength: Infinity })
          }`

        case 'GuildMemberAdd':
        case 'GuildMemberRemove':
          return `${format(event.member.guild)} ${event.member.user.tag}`

        case 'GuildMemberUpdate':
          return `${format(event.newMember.guild)} ${event.newMember.user.tag}`

        case 'VoiceStateUpdate':
          return `${format(
            event.oldState.guild,
            event.oldState.member?.user ?? event.newState.member?.user,
          )} ${maybeChannel(event.oldState.channel)} > ${maybeChannel(event.newState.channel)}`

        case 'AudioChannelConnected':
        case 'AudioChannelDisconnected':
          return `${format(event.channel.guild, event.member.user)} 📢${event.channel.name}`

        case 'AudioChannelMoved':
          return `${format(event.from.guild, event.member.user)} 📢${event.from.name} > 📢${
            event.to.name
          }`

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
    if (message !== null) return Future.fromIOEither(logger.info('✉️ ', event.type, message))
    return Future.notUsed
  },
})

const maybeChannel = (channel: GuildAudioChannel | null): string =>
  channel === null ? 'null' : `📢${channel.name}`
