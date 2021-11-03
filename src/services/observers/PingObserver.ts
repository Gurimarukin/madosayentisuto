import { InteractionCreate } from '../../models/MadEvent'
import { TObserver } from '../../models/TObserver'
import { Future } from '../../utils/fp'

export const PingObserver = (): TObserver<InteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (!interaction.isCommand()) return Future.unit

    if (interaction.commandName === 'ping') {
      return Future.tryCatch(() => interaction.reply({ content: 'pong', ephemeral: true }))
    }

    return Future.unit
  },
})
