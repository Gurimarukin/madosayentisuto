import type { ChatInputCommandInteraction } from 'discord.js'
import { GuildMember } from 'discord.js'
import { random } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import * as D from 'io-ts/Decoder'

import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { NotUsed } from '../../../shared/utils/fp'
import { Either, Future, List, Maybe, NonEmptyArray } from '../../../shared/utils/fp'

import { constants } from '../../config/constants'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Command } from '../../models/discord/Command'
import { MessageComponent } from '../../models/discord/MessageComponent'
import { MadEvent } from '../../models/event/MadEvent'

const Keys = {
  ping: 'ping',
  randomcase: 'randomcase',
  message: 'message',
  kohLanta: 'koh-lanta',
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

const kohLantaCommand = Command.chatInput({
  name: Keys.kohLanta,
  description: "Jean Plank élimine quelqu'un au hasard dans votre salon vocal",
})()

export const otherCommands = [pingCommand, randomCaseCommand, kohLantaCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const OtherCommandsObserver = (clientId: DiscordUserId) => {
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
      case Keys.kohLanta:
        return onKohLanta(interaction)
    }
    return Future.notUsed
  }

  function onPing(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return DiscordConnector.interactionReply(interaction, { content: 'pong', ephemeral: true })
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
    )
  }

  function onKohLanta(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      interaction.member instanceof GuildMember
        ? Maybe.fromNullable(interaction.member.voice.channel)
        : Maybe.none,
      Either.fromOption(() => 'Haha ! Il faut être dans un salon vocal pour faire ça !'),
      Either.chainOptionK(() => 'Erreur')(channel =>
        pipe(
          channel.members.toJSON(),
          List.filter(m => !DiscordUserId.Eq.equals(DiscordUserId.fromUser(m.user), clientId)),
          NonEmptyArray.fromReadonlyArray,
        ),
      ),
      Either.map(random.randomElem),
      Either.fold(
        content => DiscordConnector.interactionReply(interaction, { content, ephemeral: true }),
        flow(
          Future.fromIO,
          Future.chainFirst(eliminated =>
            DiscordConnector.voiceStateDisconnect(
              eliminated.voice,
              "J'ai décidé de vous éliminer et ma sentence est irrévocable.",
            ),
          ),
          Future.chain(eliminated =>
            DiscordConnector.interactionReply(interaction, {
              embeds: [
                MessageComponent.safeEmbed({
                  color: constants.messagesColor,
                  description: `J'ai décidé d'éliminer ${eliminated} et ma sentence est irrévocable.`,
                }),
              ],
              ephemeral: false,
            }),
          ),
        ),
      ),
    )
  }
}
