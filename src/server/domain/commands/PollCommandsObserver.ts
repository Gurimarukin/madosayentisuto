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
import { apply } from 'fp-ts'
import type { Lazy } from 'fp-ts/function'
import { flow, pipe } from 'fp-ts/function'

import { ValidatedNea } from '../../../shared/models/ValidatedNea'
import { GuildId } from '../../../shared/models/guild/GuildId'
import { UserId } from '../../../shared/models/guild/UserId'
import { StringUtils } from '../../../shared/utils/StringUtils'
import type { IO } from '../../../shared/utils/fp'
import { Tuple } from '../../../shared/utils/fp'
import { toUnit } from '../../../shared/utils/fp'
import { Dict } from '../../../shared/utils/fp'
import { Either } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import type { EmojiWithAnswer } from '../../helpers/messages/pollMessage'
import { Answer, pollMessage } from '../../helpers/messages/pollMessage'
import { TSnowflake } from '../../models/TSnowflake'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { PollButton } from '../../models/poll/PollButton'
import { PollResponse } from '../../models/poll/PollResponse'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { PollResponseService } from '../../services/PollResponseService'
import { LogUtils } from '../../utils/LogUtils'
import { jsonStringify } from '../../utils/jsonStringify'

const choices = pipe(
  NonEmptyArray.range(1, 5),
  NonEmptyArray.map(i => Tuple.of(`choix${i}`, `Choix ${i}`)),
)

const Keys = {
  poll: 'sondage',
  question: 'question',
  choices: pipe(choices, NonEmptyArray.map(Tuple.fst)),
}

export const pollCommand = pipe(
  choices,
  NonEmptyArray.reduce(
    new SlashCommandBuilder()
      .setName(Keys.poll)
      .setDescription('Jean Plank fait des sondages')
      .addStringOption(option =>
        option.setName(Keys.question).setDescription('La question du sondage').setRequired(true),
      ),
    (acc, [name, description]) =>
      acc.addStringOption(option => option.setName(name).setDescription(description)),
  ),
)

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollCommandsObserver = (
  Logger: LoggerGetter,
  clientId: string,
  pollResponseService: PollResponseService,
) => {
  const logger = Logger('PollCommandsObserver')

  return ObserverWithRefinement.fromNext(
    MadEvent,
    'InteractionCreate',
    'MessageDelete',
  )(event => {
    switch (event.type) {
      case 'InteractionCreate':
        return onInteraction(event.interaction)

      case 'MessageDelete':
        return onMessageDelete(event.messages)
    }
  })

  // onInteraction
  function onInteraction(interaction: Interaction): Future<void> {
    if (interaction.isCommand()) {
      switch (interaction.commandName) {
        case Keys.poll:
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
          question: Maybe.fromNullable(interaction.options.getString(Keys.question)),
        }),
      ),
      futureMaybe.chainFuture(({ channel, question }) => initPoll(interaction, channel, question)),

      Future.map(toUnit),
    )
  }

  function initPoll(
    interaction: CommandInteraction,
    channel: TextBasedChannel,
    question: string,
  ): Future<void> {
    return pipe(
      parseAnswers_(interaction),
      getWithEmojis,
      futureMaybe.map(withEmojis => ({
        options: pollMessage.format({
          question,
          answers: withEmojis,
          author: interaction.user.toString(),
        }),
      })),
      futureMaybe.bind('message', ({ options }) => DiscordConnector.sendMessage(channel, options)),
      futureMaybe.chainFuture(({ message, options }) =>
        DiscordConnector.messageEdit(message, options),
      ),
      Future.map(toUnit),
    )
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
      PollButton.parse(interaction.customId),
      Maybe.fold(
        () => Future.unit,
        button =>
          pipe(
            DiscordConnector.interactionUpdate(interaction),
            Future.chain(() => futureMaybe.fromNullable(interaction.guild)),
            futureMaybe.chainFuture(guild =>
              castVote(guild, interaction.message, interaction.user, button),
            ),
            Future.map(toUnit),
          ),
      ),
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
        user: UserId.wrap(user.id),
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
      user: UserId.wrap(user.id),
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
      Future.map(toUnit),
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
          Future.map(toUnit),
        ),
      ),
    )
  }
}

const parseAnswers_ = (interaction: CommandInteraction): NonEmptyArray<string> =>
  pipe(
    Keys.choices,
    List.filterMap(choice => pipe(interaction.options.getString(choice), Maybe.fromNullable)),
    NonEmptyArray.fromReadonlyArray,
    Maybe.getOrElse((): NonEmptyArray<string> => ['Oui', 'Non']),
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
