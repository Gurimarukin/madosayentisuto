import type { ChatInputCommandInteraction } from 'discord.js'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future } from '../../../shared/utils/fp'
import { futureEither } from '../../../shared/utils/futureEither'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'

const Keys = {
  shifumi: 'shi-fu-mi',
  opponent: 'adversaire',
}

const shifumiCommand = Command.chatInput({
  name: Keys.shifumi,
  description: "Jean Plank vous permet de défier quelqu'un pour un duel de pierre-feuille-ciseaux",
})(
  Command.option.user({
    name: Keys.opponent,
    description: 'La personne que vous défiez (essayez de me défier, pour voir ?)',
    required: true,
  }),
)

export const shifumiCommands = [shifumiCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const ShifumiObserver = () => {
  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
  )(({ interaction }) => {
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
    return Future.notUsed
  })

  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.shifumi:
        return onShifumi(interaction)
    }
    return Future.notUsed
  }

  function onShifumi(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      interaction.options.getUser(Keys.opponent),
      futureEither.fromNullable('Erreur'),
      futureEither.filterOrElse(
        u =>
          !DiscordUserId.Eq.equals(
            DiscordUserId.fromUser(u),
            DiscordUserId.fromUser(interaction.user),
          ),
        () => 'Haha ! Tu ne peux pas te défier toi-même !',
      ),
      Future.chain(
        Either.fold(
          content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
          user =>
            DiscordConnector.interactionReply(interaction, {
              content: `Utilisateur défié: ${user}`,
              ephemeral: false,
            }),
        ),
      ),
    )
  }
}
