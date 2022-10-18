import type { ChatInputCommandInteraction } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import type { NotUsed } from '../../../shared/models/NotUsed'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either, Future, toNotUsed } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'

const Keys = {
  ping: 'ping',
  randomcase: 'randomcase',
  message: 'message',
}

const pingCommand = Command.chatInput({
  name: Keys.ping,
  description: 'Jean Plank répond pong',
  isGlobal: true,
})()

const randomCaseCommand = Command.chatInput({
  name: Keys.randomcase,
  description: 'Jean Plank vous prend pour un débile',
  isGlobal: true,
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
  )(({ interaction }) => {
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
    return Future.notUsed
  })

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.ping:
        return onPing(interaction)
      case Keys.randomcase:
        return onRandomCase(interaction)
    }
    return Future.notUsed
  }

  function onPing(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true }),
      Future.map(toNotUsed),
    )
  }

  function onRandomCase(interaction: ChatInputCommandInteraction): Future<NotUsed> {
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
      Future.map(toNotUsed),
    )
  }
}
