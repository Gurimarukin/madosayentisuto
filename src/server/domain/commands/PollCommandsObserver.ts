import { SlashCommandBuilder } from '@discordjs/builders'
import type { APIMessage } from 'discord-api-types'
import type {
  CommandInteraction,
  Message,
  MessageOptions,
  TextBasedChannel,
  User,
} from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'

import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { Tuple } from '../../../shared/utils/fp'
import { Either } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import { Colors, constants } from '../../constants'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { MadEventInteractionCreate } from '../../models/events/MadEvent'
import type { TObserver } from '../../models/rx/TObserver'
import { MessageUtils } from '../../utils/MessageUtils'

type Emoji = string
type Answer = Tuple<Emoji, string>

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
        'Réponses possibles, entre guillemets et séparées par des espaces ("Oui" "Non", si vide).',
      ),
  )

export const PollCommandsObserver = (): TObserver<MadEventInteractionCreate> => ({
  next: event => {
    const interaction = event.interaction

    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case 'poll':
          return onPoll(interaction)
      }
    }

    if (interaction.isButton()) {
    }

    return Future.unit
  },
})

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
  const author = interaction.user
  return pipe(
    Maybe.fromNullable(interaction.options.getString('réponses')),
    Maybe.fold(() => Either.right<string, NonEmptyArray<string>>(['Oui', 'Non']), parseAnswers),
    Either.foldW(
      content => DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      flow(
        NonEmptyArray.mapWithIndex((i, a): Answer => [getEmoji(i), a]),
        answers =>
          DiscordConnector.sendMessage(channel, getPollMessage({ question, answers, author })),
      ),
    ),
    Future.map<Maybe<Message> | Message | APIMessage, void>(() => {}),
  )
}

const surroundedWithQuotesError = Either.left('Les réponses doivent être entourées de guillemets')
export const parseAnswers = (rawAnswers: string): Either<string, NonEmptyArray<string>> => {
  const split = rawAnswers.split('"')

  if (!isOdd(split.length)) return surroundedWithQuotesError

  return pipe(
    split,
    List.filterMapWithIndex((i, w) => {
      const trimed = w.trim()
      if (isOdd(i)) {
        // it is a word between quotes
        return Maybe.some(
          trimed === '' ? Either.left('Une réponse ne peut être vide') : Either.right(w),
        )
      }
      // it is some filling chars
      return trimed === '' ? Maybe.none : Maybe.some(surroundedWithQuotesError)
    }),
    Either.sequenceArray,
    Either.chain(
      flow(
        List.takeLeft(26),
        NonEmptyArray.fromReadonlyArray,
        Either.fromOption(() => 'Au moins une réponse est requise'),
      ),
    ),
  )
}

const isOdd = (n: number): boolean => n % 2 === 1

type EmojiKey = keyof typeof constants.emojis.characters
const emojis = pipe(
  NonEmptyArray.range(97, 122),
  NonEmptyArray.map(i => constants.emojis.characters[String.fromCharCode(i) as EmojiKey]),
)
const getEmoji = (i: number): string => emojis[i] as string

type GetPollMessage = {
  readonly question: string
  readonly answers: NonEmptyArray<Answer>
  readonly author: User
}

const getPollMessage = ({ question, answers, author }: GetPollMessage): MessageOptions => ({
  embeds: [
    MessageUtils.safeEmbed({
      title: question,
      description: StringUtils.stripMargins(
        `${pipe(
          answers,
          NonEmptyArray.fromReadonlyArray,
          Maybe.map(
            flow(
              NonEmptyArray.map(([emoji, answer]) => `${emoji}  ${answer}`),
              StringUtils.mkString('', '\n\n', '\n\n'),
            ),
          ),
          Maybe.getOrElse(() => ''),
        )}*Sondage créé par ${author}*`,
      ),
      color: Colors.darkred,
    }),
  ],
  // components: [
  //   new MessageActionRow().addComponents(
  //     new MessageButton()
  //       .setCustomId(callsButton.subscribeId)
  //       .setLabel("S'abonner aux appels")
  //       .setStyle('PRIMARY')
  //       .setEmoji(constants.emojis.calls),
  //     new MessageButton()
  //       .setCustomId(callsButton.unsubscribeId)
  //       .setLabel(' ̶S̶e̶ ̶d̶é̶s̶a̶b̶o̶n̶n̶e̶r̶    Je suis une victime')
  //       .setStyle('SECONDARY'),
  //   ),
  // ],
})
