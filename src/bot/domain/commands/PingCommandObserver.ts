import { SlashCommandBuilder } from '@discordjs/builders'

import { Future } from 'shared/utils/fp'

import { DiscordConnector } from 'bot/helpers/DiscordConnector'
import type { InteractionCreate } from 'bot/models/MadEvent'
import type { TObserver } from 'bot/models/rx/TObserver'

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
