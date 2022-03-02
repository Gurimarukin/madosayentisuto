import { SlashCommandBuilder } from '@discordjs/builders'
import type {
  CommandInteraction,
  Interaction,
  Message,
  PartialMessage,
  TextBasedChannel,
} from 'discord.js'
import { apply, string } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import { parse as shellQuoteParse } from 'shell-quote'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { Either } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Answer, pollMessage } from '../../helpers/messages/pollMessage'
import { TSnowflake } from '../../models/TSnowflake'
import type { MadEventInteractionCreate, MadEventMessageDelete } from '../../models/events/MadEvent'
import type { TObserver } from '../../models/rx/TObserver'

export const pollCommand = new SlashCommandBuilder()
  .setName('poll')
  .setDescription('Jean Plank fait des sondages')
  .addStringOption(option =>
    option.setName('question').setDescription('La question du sondage').setRequired(true),
  )
  .addStringOption(option =>
    option
      .setName('réponses')
      .setDescription(
        'Réponses possibles.\nEntre guillemets et séparées par des espaces ("Oui" "Non", si vide).',
      ),
  )

export const PollCommandsObserver = (): TObserver<
  MadEventInteractionCreate | MadEventMessageDelete
> => ({
  next: event => {
    switch (event.type) {
      case 'InteractionCreate':
        return onInteraction(event.interaction)

      case 'MessageDelete':
        return onMessageDelete(event.messages)
    }
  },
})

const onInteraction = (interaction: Interaction): Future<void> => {
  if (interaction.isCommand()) {
    switch (interaction.commandName) {
      case 'poll':
        return onPoll(interaction)
    }
  }

  if (interaction.isButton()) {
  }

  return Future.unit
}

const onPoll = (interaction: CommandInteraction): Future<void> =>
  pipe(
    DiscordConnector.interactionReply(interaction, { content: '...', ephemeral: false }),
    Future.chain(() => DiscordConnector.interactionDeleteReply(interaction)),
    Future.map(() =>
      apply.sequenceS(Maybe.Apply)({
        channel: Maybe.fromNullable(interaction.channel),
        question: Maybe.fromNullable(interaction.options.getString('question')),
      }),
    ),
    futureMaybe.chainFuture(({ channel, question }) => initPoll(interaction, channel, question)),
    Future.map(() => {}),
  )

const initPoll = (
  interaction: CommandInteraction,
  channel: TextBasedChannel,
  question: string,
): Future<void> => {
  return pipe(
    Maybe.fromNullable(interaction.options.getString('réponses')),
    Maybe.fold(() => Either.right<string, NonEmptyArray<string>>(['Oui', 'Non']), parseAnswers),
    Either.fold(
      content =>
        pipe(
          DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
          Future.map(() => {}),
        ),
      sendAndUpdateMessage,
    ),
  )

  function sendAndUpdateMessage(answers: NonEmptyArray<string>): Future<void> {
    const withEmojis = pipe(
      answers,
      NonEmptyArray.mapWithIndex((i, answer) => Answer.of(answer, i)),
    )
    return pipe(
      DiscordConnector.sendMessage(
        channel,
        pollMessage.base(question, withEmojis, interaction.user),
      ),
      futureMaybe.chainFuture(message =>
        DiscordConnector.messageEdit(
          message,
          pollMessage.withButtons(
            TSnowflake.wrap(message.id),
            question,
            withEmojis,
            interaction.user,
          ),
        ),
      ),
      Future.map(() => {}),
    )
  }
}

const parseAnswers = (rawAnswers: string): Either<string, NonEmptyArray<string>> =>
  pipe(
    shellQuoteParse(rawAnswers),
    List.filter(string.isString),
    NonEmptyArray.fromReadonlyArray,
    Either.fromOption(() => `Impossible de lire les réponses: ${rawAnswers}`),
  )

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const onMessageDelete = (messages: List<Message | PartialMessage>): Future<void> =>
  // TODO
  Future.unit
