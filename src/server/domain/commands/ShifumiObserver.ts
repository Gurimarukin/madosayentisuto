import type {
  ChatInputCommandInteraction,
  GuildMember,
  MessageCreateOptions,
  User,
} from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future } from '../../../shared/utils/fp'
import { futureEither } from '../../../shared/utils/futureEither'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

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
export const ShifumiObserver = (clientId: DiscordUserId) => {
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
      // futureMaybe.fromNullable(interaction.guild),
      // futureMaybe.bindTo('guild'),
      // futureMaybe
      apply.sequenceS(futureMaybe.ApplyPar)({
        guild: futureMaybe.fromNullable(interaction.guild),
        // defier: pipe(
        //   futureMaybe.fromNullable(interaction.member),
        //   futureMaybe.chain()
        // ),
        defied: futureMaybe.fromNullable(interaction.options.getUser(Keys.opponent)),
      }),
      futureMaybe.bind('defier', ({ guild }) => pipe()),
      Future.map(Either.fromOption(() => 'Erreur')),
      futureEither.filterOrElse(
        ({ defier, defied }) =>
          !DiscordUserId.Eq.equals(
            DiscordUserId.fromUser(defier.user),
            DiscordUserId.fromUser(defied),
          ),
        () => 'Haha ! Tu ne peux pas te défier toi-même !',
      ),
      futureEither.map(({ defier, defied }) =>
        DiscordUserId.Eq.equals(DiscordUserId.fromUser(defied), clientId)
          ? shifumiJPMessage(defier)
          : shifumiDuelMessage(defier, defied),
      ),
      Future.chain(
        Either.fold(
          content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
          options => DiscordConnector.interactionReply(interaction, options),
        ),
      ),
    )
  }

  // function
}

const shifumiDuelMessage = (defier: GuildMember, defied: User): MessageCreateOptions => ({
  content: `Haha !\n**${defier.displayName}** défie ${defied} à un duel de pierre-feuille-ciseaux !`,
})

const shifumiJPMessage = (defier: GuildMember): MessageCreateOptions => ({
  content: `Haha !\n**${defier.displayName}** me défie à un duel de pierre-feuille-ciseaux !`,
})
