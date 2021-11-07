import { SlashCommandBuilder } from '@discordjs/builders'

import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future } from '../../../utils/fp'
import { DiscordConnector } from '../../DiscordConnector'

export const pingObserverCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Jean Plank répond pong')

export const PingObserver = (): TObserver<InteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (!interaction.isCommand() || interaction.commandName !== 'ping') return Future.unit

    return DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true })
  },
})
