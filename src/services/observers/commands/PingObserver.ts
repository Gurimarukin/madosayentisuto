import { SlashCommandBuilder } from '@discordjs/builders'

import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future } from '../../../utils/fp'

export const pingObserverCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Jean Plank répond pong')

export const PingObserver = (): TObserver<InteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (!interaction.isCommand() || interaction.commandName !== pingObserverCommand.name) {
      return Future.unit
    }

    return Future.tryCatch(() => interaction.reply({ content: 'pong', ephemeral: true }))
  },
})
