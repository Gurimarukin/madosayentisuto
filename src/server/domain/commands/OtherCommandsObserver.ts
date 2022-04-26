import type { CommandInteraction } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Command } from '../../models/Command'
import { MadEvent } from '../../models/event/MadEvent'

const Keys = {
  ping: 'ping',
  randomcase: 'randomcase',
  message: 'message',
}

const pingCommand = Command.chatInput({
  name: Keys.ping,
  description: 'Jean Plank répond pong',
})()

const randomCaseCommand = Command.chatInput({
  name: Keys.randomcase,
  description: 'Jean Plank vous prend pour un débile',
})(
  Command.option.string({
    name: Keys.message,
    description: 'Que voulez-vous dire ?',
    required: true,
  }),
)

export const otherCommands = [pingCommand, randomCaseCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const OtherCommandsObserver = () => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(event => {
    const interaction = event.interaction

    if (!interaction.isCommand()) return Future.unit

    switch (interaction.commandName) {
      case Keys.ping:
        return onPing(interaction)
      case Keys.randomcase:
        return onRandomCase(interaction)
    }

    return Future.unit
  })

  function onPing(interaction: CommandInteraction): Future<void> {
    return DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true })
  }

  function onRandomCase(interaction: CommandInteraction): Future<void> {
    return pipe(
      D.string.decode(interaction.options.getString(Keys.message)),
      Either.bimap(
        e => Error(`Invalid options from command "randomcase":\n${D.draw(e)}`),
        m =>
          `Haha ! Il ne reste plus qu'à copy-pasta ce message :\n\`${StringUtils.randomCase(m)}\``,
      ),
      Future.fromEither,
      Future.chain(content =>
        DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
      ),
    )
  }
}
