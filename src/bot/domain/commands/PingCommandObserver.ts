import { SlashCommandBuilder } from '@discordjs/builders'

import { Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { InteractionCreate } from '../../models/MadEvent'
import type { TObserver } from '../../models/rx/TObserver'

export const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Jean Plank répond pong')

export const PingObserver = (): TObserver<InteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (!interaction.isCommand() || interaction.commandName !== 'ping') return Future.unit

    return DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true })
  },
})
