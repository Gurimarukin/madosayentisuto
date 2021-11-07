import { SlashCommandBuilder } from '@discordjs/builders'

import { InteractionCreate } from '../../../models/MadEvent'
import { TObserver } from '../../../models/TObserver'
import { Future } from '../../../utils/fp'

export const pingObserverCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Replies with pong!')

export const PingObserver = (): TObserver<InteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (!interaction.isCommand()) return Future.unit

    if (interaction.commandName === pingObserverCommand.name) {
      return Future.tryCatch(() => interaction.reply({ content: 'pong', ephemeral: true }))
    }

    return Future.unit
  },
})
