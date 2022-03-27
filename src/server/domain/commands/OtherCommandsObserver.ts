import { SlashCommandBuilder, inlineCode } from '@discordjs/builders'
import type { CommandInteraction } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { MadEvent } from '../../models/event/MadEvent'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'

const Keys = {
  ping: 'ping',
  randomcase: 'randomcase',
  message: 'message',
}

const pingCommand = new SlashCommandBuilder()
  .setName(Keys.ping)
  .setDescription('Jean Plank répond pong')
  .toJSON()

const randomCaseCommand = new SlashCommandBuilder()
  .setName(Keys.randomcase)
  .setDescription('Jean Plank vous prend pour un débile')
  .addStringOption(option =>
    option.setName(Keys.message).setDescription('Que voulez-vous dire ?').setRequired(true),
  )
  .toJSON()

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
          `Haha ! Il ne reste plus qu'à copy-pasta ce message :\n${inlineCode(
            StringUtils.randomCase(m),
          )}`,
      ),
      Future.fromEither,
      Future.chain(content =>
        DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
      ),
    )
  }
}
