import { SlashCommandBuilder, inlineCode } from '@discordjs/builders'
import type { CommandInteraction } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { Either, Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { TObserver } from '../../models/rx/TObserver'
import { StringUtils } from '../../utils/StringUtils'

const pingCommand = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Jean Plank répond pong')

const randomCaseCommand = new SlashCommandBuilder()
  .setName('randomcase')
  .setDescription('Jean Plank vous prend pour un débile')
  .addStringOption(option =>
    option.setName('message').setDescription('Que voulez-vous dire ?').setRequired(true),
  )

export const otherCommands = [pingCommand, randomCaseCommand]

export const OtherCommandsObserver = (): TObserver<MadEventInteractionCreate> => {
  return {
    next: event => {
      const interaction = event.interaction

      if (!interaction.isCommand()) return Future.unit

      switch (interaction.commandName) {
        case 'ping':
          return onPing(interaction)
        case 'randomcase':
          return onRandomCase(interaction)
      }

      return Future.unit
    },
  }

  function onPing(interaction: CommandInteraction): Future<void> {
    return DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true })
  }

  function onRandomCase(interaction: CommandInteraction): Future<void> {
    return pipe(
      D.string.decode(interaction.options.getString('message')),
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
