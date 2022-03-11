import { SlashCommandBuilder } from '@discordjs/builders'
import type { APIMessage } from 'discord-api-types/payloads/v9'
import { Message } from 'discord.js'
import type {
  ButtonInteraction,
  CommandInteraction,
  Guild,
  Interaction,
  PartialMessage,
  TextBasedChannel,
  User,
} from 'discord.js'
import { apply, string } from 'fp-ts'
import type { Lazy } from 'fp-ts/function'
import { flow, pipe } from 'fp-ts/function'
import { parse as shellQuoteParse } from 'shell-quote'

import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { futureMaybe } from '../../../shared/utils/FutureMaybe'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { IO } from '../../../shared/utils/fp'
import { Dict } from '../../../shared/utils/fp'
import { Either } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { EmojiWithAnswer } from '../../helpers/messages/pollMessage'
import { Answer, pollMessage } from '../../helpers/messages/pollMessage'
import { PollButton } from '../../models/PollButton'
import { PollResponse } from '../../models/PollResponse'
import { TSnowflake } from '../../models/TSnowflake'
import type { MadEventInteractionCreate, MadEventMessageDelete } from '../../models/events/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import type { TObserver } from '../../models/rx/TObserver'
import type { PollResponseService } from '../../services/PollResponseService'
import { LogUtils } from '../../utils/LogUtils'
import { jsonStringify } from '../../utils/jsonStringify'

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
  clientId: string,
  pollResponseService: PollResponseService,
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
        getWithEmojis(answers),
        futureMaybe.map(withEmojis => ({
          options: pollMessage.format({
            question,
            answers: withEmojis,
            author: interaction.user.toString(),
          }),
        })),
        futureMaybe.bind('message', ({ options }) =>
          DiscordConnector.sendMessage(channel, options),
        ),
        futureMaybe.chainFuture(({ message, options }) =>
          DiscordConnector.messageEdit(message, options),
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
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        guild: Maybe.fromNullable(interaction.guild),
        button: PollButton.parse(interaction.customId),
      }),
      Maybe.fold(
        () => Future.unit,
        ({ guild, button }) => castVote(guild, interaction.message, interaction.user, button),
      ),
      Future.chain(() => DiscordConnector.interactionUpdate(interaction)),
    )
  }

  function castVote(
    guild: Guild,
    message: APIMessage | Message,
    user: User,
    { answerIndex }: PollButton,
  ): Future<void> {
    return pipe(
      pollResponseService.lookupByUser({
        guild: GuildId.wrap(guild.id),
        message: TSnowflake.wrap(message.id),
        user: TSnowflake.wrap(user.id),
      }),
      Future.chain(
        Maybe.fold(
          () => upsertVoteAndRefreshMessage(guild, message, user, answerIndex),
          upsertIfDifferent(guild, message, user, answerIndex),
        ),
      ),
    )
  }

  function upsertIfDifferent(
    guild: Guild,
    message: APIMessage | Message,
    user: User,
    answerIndex: number,
  ): (previousReponse: PollResponse) => Future<void> {
    return previousReponse =>
      answerIndex === previousReponse.answerIndex
        ? Future.unit
        : upsertVoteAndRefreshMessage(guild, message, user, answerIndex)
  }

  function upsertVoteAndRefreshMessage(
    guild: Guild,
    message: APIMessage | Message,
    user: User,
    answerIndex: number,
  ): Future<void> {
    const response: PollResponse = {
      guild: GuildId.wrap(guild.id),
      message: TSnowflake.wrap(message.id),
      user: TSnowflake.wrap(user.id),
      answerIndex,
    }

    return pipe(
      pollResponseService.upsert(response),
      Future.chain(success =>
        success
          ? refreshMessageFromDb(guild, message)
          : Future.fromIOEither(
              LogUtils.pretty(logger, guild).warn(
                `Failed to upsert ${jsonStringify(PollResponse.codec)(response)}`,
              ),
            ),
      ),
    )
  }

  function refreshMessageFromDb(guild: Guild, message_: APIMessage | Message): Future<void> {
    const log = LogUtils.pretty(logger, guild)
    return pipe(
      futureMaybe.Do,
      futureMaybe.bind('message', () =>
        pipe(
          message_ instanceof Message
            ? Future.right(Maybe.some(message_))
            : DiscordConnector.fetchMessage(guild, TSnowflake.wrap(message_.id)),
          onNone(() => log.warn(`Couldn't fetch message ${message_.id}`)),
        ),
      ),
      futureMaybe.bind('parsed', ({ message }) =>
        pipe(
          pollMessage.parse(message),
          futureMaybe.fromOption,
          onNone(() => log.warn(`Couldn't pollMessage.parse message ${message.id}`)),
        ),
      ),
      futureMaybe.bind('responses', () =>
        futureMaybe.fromFuture(
          pollResponseService.listForMessage({
            guild: GuildId.wrap(guild.id),
            message: TSnowflake.wrap(message_.id),
          }),
        ),
      ),
      futureMaybe.chainFuture(({ message, parsed: { question, answers, author }, responses }) =>
        DiscordConnector.messageEdit(
          message,
          pollMessage.format({ question, answers: answersWithCount(answers, responses), author }),
        ),
      ),
      Future.map(() => {}),
    )
  }

  // onMessageDelete
  function onMessageDelete(messages: List<Message | PartialMessage>): Future<void> {
    return pipe(
      messages,
      List.filterMap(m =>
        m.guild !== null && m.author?.id === clientId
          ? Maybe.some({ guild: m.guild, message: TSnowflake.wrap(m.id) })
          : Maybe.none,
      ),
      NonEmptyArray.fromReadonlyArray,
      Maybe.fold(
        () => Future.unit,
        flow(
          NonEmptyArray.groupBy(({ guild }) => guild.id),
          Dict.toReadonlyArray,
          Future.traverseArray(([guildId, nea]) => {
            const { guild } = NonEmptyArray.head(nea)
            const toDelete = pipe(
              nea,
              NonEmptyArray.map(e => e.message),
            )
            return pipe(
              pollResponseService.deleteByMessageIds(GuildId.wrap(guildId), toDelete),
              Future.chainIOEitherK(n =>
                LogUtils.pretty(logger, guild).info(`Deleted ${n} poll messages`),
              ),
            )
          }),
          Future.map<List<void>, void>(() => {}),
        ),
      ),
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

const answersWithCount = (
  answers: NonEmptyArray<EmojiWithAnswer>,
  responses: List<PollResponse>,
): NonEmptyArray<Answer> =>
  pipe(
    answers,
    NonEmptyArray.mapWithIndex(
      (answerIndex, { emoji, answer }): Answer => ({
        emoji,
        answer,
        votesCount: pipe(
          responses,
          List.filter(r => r.answerIndex === answerIndex),
          List.size,
        ),
      }),
    ),
  )

// side effect if fa is None
const onNone =
  <A, B>(f: Lazy<IO<B>>) =>
  (fa: Future<Maybe<A>>): Future<Maybe<A>> =>
    pipe(
      fa,
      Future.chain(
        Maybe.fold(
          () =>
            pipe(
              f(),
              Future.fromIOEither,
              Future.map(() => Maybe.none),
            ),
          flow(Maybe.some, Future.right),
        ),
      ),
    )
