import { SlashCommandBuilder } from '@discordjs/builders'
import type {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  Message,
  PartialMessage,
  TextBasedChannel,
} from 'discord.js'
import { apply, string } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { parse as shellQuoteParse } from 'shell-quote'

import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { StringUtils } from '../../../shared/utils/StringUtils'
import { Either } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { Answer, pollMessage } from '../../helpers/messages/pollMessage'
import { PollButton } from '../../models/PollButton'
import { TSnowflake } from '../../models/TSnowflake'
import type { MadEventInteractionCreate, MadEventMessageDelete } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
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

export const PollCommandsObserver = (
  Logger: LoggerGetter,
): TObserver<MadEventInteractionCreate | MadEventMessageDelete> => {
  const logger = Logger('PollCommandsObserver')

  return {
    next: event => {
      switch (event.type) {
        case 'InteractionCreate':
          return onInteraction(event.interaction)

        case 'MessageDelete':
          return onMessageDelete(event.messages)
      }
    },
  }

  // onInteraction
  function onInteraction(interaction: Interaction): Future<void> {
    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case 'poll':
          return onPollCommand(interaction)
      }
    }

    if (interaction.isButton()) {
      return onButtonInteraction(interaction)
    }

    return Future.unit
  }

  // onPollCommand
  function onPollCommand(interaction: CommandInteraction): Future<void> {
    return pipe(
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
  }

  function initPoll(
    interaction: CommandInteraction,
    channel: TextBasedChannel,
    question: string,
  ): Future<void> {
    return pipe(
      Maybe.fromNullable(interaction.options.getString('réponses')),
      Maybe.fold(() => Either.right<string, NonEmptyArray<string>>(['Oui', 'Non']), parseAnswers),
      Either.fold(
        content =>
          pipe(
            DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
            Future.map(() => {}),
          ),
        sendAndUpdateInitMessage,
      ),
    )

    function sendAndUpdateInitMessage(answers: NonEmptyArray<string>): Future<void> {
      return pipe(
        futureMaybe.Do,
        futureMaybe.apS('withEmojis', getWithEmojis(answers)),
        futureMaybe.bind('message', ({ withEmojis }) =>
          DiscordConnector.sendMessage(
            channel,
            pollMessage.base(question, withEmojis, interaction.user),
          ),
        ),
        futureMaybe.chainFuture(({ withEmojis, message }) =>
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

  function getWithEmojis(answers: NonEmptyArray<string>): Future<Maybe<NonEmptyArray<Answer>>> {
    return pipe(
      answers,
      NonEmptyArray.traverseWithIndex(ValidatedNea.stringValidation)((emojiIndex, answer) =>
        Answer.fromIndex({ answer, emojiIndex, votesCount: 0 }),
      ),
      Either.fold(
        errors =>
          pipe(
            logger.warn(
              `Error while getting answers:\n${pipe(errors, StringUtils.mkString('\n'))}`,
            ),
            Future.fromIOEither,
            Future.map(() => Maybe.none),
          ),
        flow(Maybe.some, Future.right),
      ),
    )
  }

  // onButtonInteraction
  function onButtonInteraction(interaction: ButtonInteraction): Future<void> {
    const parsed = PollButton.parse(interaction.customId)

    console.log('parsed =', parsed)

    return Future.unit
  }

  // onMessageDelete
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function onMessageDelete(messages: List<Message | PartialMessage>): Future<void> {
    // TODO
    return Future.unit
  }
}

const parseAnswers = (rawAnswers: string): Either<string, NonEmptyArray<string>> =>
  pipe(
    shellQuoteParse(rawAnswers),
    List.filter(string.isString),
    NonEmptyArray.fromReadonlyArray,
    Either.fromOption(() => `Impossible de lire les réponses: ${rawAnswers}`),
  )
