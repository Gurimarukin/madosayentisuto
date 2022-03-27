import { SlashCommandBuilder } from '@discordjs/builders'
import type { APIMessage } from 'discord-api-types/payloads/v9'
import type { RESTPostAPIApplicationCommandsJSONBody } from 'discord-api-types/rest/v9'
import type { Guild, Message } from 'discord.js'
import type {
  ButtonInteraction,
  CommandInteraction,
  Interaction,
  MessageContextMenuInteraction,
  PartialMessage,
  TextBasedChannel,
  User,
} from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { UserId } from '../../../shared/models/guild/UserId'
import { IO } from '../../../shared/utils/fp'
import { Tuple } from '../../../shared/utils/fp'
import { toUnit } from '../../../shared/utils/fp'
import { List } from '../../../shared/utils/fp'
import { Maybe } from '../../../shared/utils/fp'
import { NonEmptyArray } from '../../../shared/utils/fp'
import { Future } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import { DiscordConnector } from '../../helpers/DiscordConnector'
import { pollMessage } from '../../helpers/messages/pollMessage'
import { MessageId } from '../../models/MessageId'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerType'
import { ChoiceWithResponses } from '../../models/poll/ChoiceWithResponses'
import { ChoiceWithVotesCount } from '../../models/poll/ChoiceWithVotesCount'
import { Poll } from '../../models/poll/Poll'
import { PollButton } from '../../models/poll/PollButton'
import { PollResponse } from '../../models/poll/PollResponse'
import { ObserverWithRefinement } from '../../models/rx/ObserverWithRefinement'
import type { PollService } from '../../services/PollService'
import { LogUtils } from '../../utils/LogUtils'

const keysChoices = pipe(
  NonEmptyArray.range(1, 5),
  NonEmptyArray.map(i => Tuple.of(`choix${i}`, `Choix ${i}`)),
)

const Keys = {
  poll: 'sondage',
  question: 'question',
  choices: pipe(keysChoices, NonEmptyArray.map(Tuple.fst)),
  deletePoll: 'Supprimer sondage',
}

const pollCommand = pipe(
  keysChoices,
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

const messageDeleteCommand: RESTPostAPIApplicationCommandsJSONBody = {
  type: 3,
  name: Keys.deletePoll,
}

const isMultiple = false

export const pollCommands = [pollCommand.toJSON(), messageDeleteCommand]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollCommandsObserver = (
  Logger: LoggerGetter,
  clientId: string,
  admins: NonEmptyArray<UserId>,
  pollService: PollService,
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
    if (interaction.isCommand()) return onCommand(interaction)
    if (interaction.isButton()) return onButton(interaction)
    if (interaction.isMessageContextMenu()) return onMessageContextMenu(interaction)
    return Future.unit
  }

  // onCommand
  function onCommand(interaction: CommandInteraction): Future<void> {
    switch (interaction.commandName) {
      case Keys.poll:
        return onPollCommand(interaction)
    }
    return Future.unit
  }

  // onPollCommand
  function onPollCommand(interaction: CommandInteraction): Future<void> {
    return pipe(
      DiscordConnector.interactionReply(interaction, { content: '...', ephemeral: false }),
      Future.chain(() => DiscordConnector.interactionDeleteReply(interaction)),
      Future.chain(() =>
        apply.sequenceS(futureMaybe.ApplyPar)({
          channel: futureMaybe.fromNullable(interaction.channel),
          question: futureMaybe.fromNullable(interaction.options.getString(Keys.question)),
        }),
      ),
      futureMaybe.chainFuture(({ channel, question }) =>
        initPoll(channel, interaction.user, question, getChoices(interaction)),
      ),
      Future.map(toUnit),
    )
  }

  function initPoll(
    channel: TextBasedChannel,
    user: User,
    question: string,
    choices: NonEmptyArray<string>,
  ): Future<void> {
    const createdBy = UserId.wrap(user.id)
    const options = pollMessage(
      createdBy,
      question,
      pipe(choices, NonEmptyArray.map(ChoiceWithVotesCount.empty)),
    )
    return pipe(
      DiscordConnector.sendMessage(channel, options),
      futureMaybe.chainFirstFuture(message =>
        // we want the `(edited)` label on message so we won't have a layout shift
        DiscordConnector.messageEdit(message, options),
      ),
      futureMaybe.chainFuture(message =>
        pollService.createPoll({
          message: MessageId.wrap(message.id),
          createdBy,
          question,
          choices,
        }),
      ),
      futureMaybe.matchE(
        () => Future.unit,
        success =>
          success ? Future.unit : Future.fromIOEither(logger.warn('Failed to create poll')),
      ),
    )
  }

  // onButton
  function onButton(interaction: ButtonInteraction): Future<void> {
    return pipe(
      PollButton.parse(interaction.customId),
      Maybe.fold(
        () => Future.unit,
        button =>
          pipe(
            DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
            Future.map(() => Maybe.fromNullable(interaction.guild)),
            futureMaybe.chain(guild =>
              castVote(guild, interaction.message, interaction.user, button),
            ),
            Future.map(Maybe.getOrElse(() => 'Erreur')),
            Future.chain(content =>
              DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
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
    { choiceIndex }: PollButton,
  ): Future<Maybe<string>> {
    const messageId = MessageId.wrap(message.id)
    const userId = UserId.wrap(user.id)
    return pipe(
      pollService.lookupPollByMessage(messageId),
      futureMaybe.chain(poll =>
        pipe(
          poll.choices,
          List.lookup(choiceIndex),
          Maybe.fold(
            () => Future.right(Maybe.none),
            choice => {
              const alreadyVotedForChoice = pipe(choice.responses, List.elem(UserId.Eq)(userId))
              if (alreadyVotedForChoice) {
                return pipe(
                  removeResponse(poll, userId, choiceIndex),
                  Future.map(p => Maybe.some(Tuple.of(p, 'Vote supprimé'))),
                )
              }
              return pipe(
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                isMultiple
                  ? Future.right(poll)
                  : // we want only one response
                    removeResponsesForUser(poll, userId),
                Future.chain(addResponse(userId, choiceIndex)),
                Future.map(p => Maybe.some(Tuple.of(p, 'Vote pris en compte'))),
              )
            },
          ),
        ),
      ),
      futureMaybe.chainFirstFuture(flow(Tuple.fst, refreshMessage(guild))),
      Future.map(Maybe.map(Tuple.snd)),
    )
  }

  function removeResponsesForUser(poll: Poll, user: UserId): Future<Poll> {
    const toRemove = pipe(
      poll.choices,
      List.chain(
        flow(
          ChoiceWithResponses.Lens.responses.get,
          List.filter(id => id === user),
        ),
      ),
      List.size,
    )
    if (toRemove === 0) return Future.right(poll)
    return pipe(
      pollService.removeResponsesForUser(poll.message, user),
      Future.chainIOEitherK(count =>
        count === toRemove ? IO.unit : logger.warn('Weird responses deletion count'),
      ),
      Future.map(() =>
        pipe(
          Poll.Lens.choices,
          lens.modify(
            NonEmptyArray.map(
              pipe(ChoiceWithResponses.Lens.responses, lens.modify(List.filter(id => id !== user))),
            ),
          ),
        )(poll),
      ),
    )
  }

  function addResponse(user: UserId, choiceIndex: number): (poll: Poll) => Future<Poll> {
    return poll =>
      pipe(
        pollService.createResponse(PollResponse.of(poll.message, user, choiceIndex)),
        Future.chainIOEitherK(success =>
          success ? IO.unit : logger.warn('Failed to add response'),
        ),
        Future.map(() =>
          pipe(
            Poll.Lens.choices,
            lens.modify(
              nonEmptyArrayModifyAt(
                choiceIndex,
                pipe(
                  ChoiceWithResponses.Lens.responses,
                  lens.modify<List<UserId>>(List.append(user)),
                ),
              ),
            ),
          )(poll),
        ),
      )
  }

  function removeResponse(poll: Poll, user: UserId, choiceIndex: number): Future<Poll> {
    return pipe(
      pollService.removeResponse(PollResponse.of(poll.message, user, choiceIndex)),
      Future.chainIOEitherK(success =>
        success ? IO.unit : logger.warn('Failed to remove response'),
      ),
      Future.map(() =>
        pipe(
          Poll.Lens.choices,
          lens.modify(
            nonEmptyArrayModifyAt(
              choiceIndex,
              pipe(ChoiceWithResponses.Lens.responses, lens.modify(List.filter(id => id !== user))),
            ),
          ),
        )(poll),
      ),
    )
  }

  function refreshMessage(guild: Guild): (poll: Poll) => Future<Maybe<Message>> {
    return poll =>
      pipe(
        DiscordConnector.fetchMessage(guild, poll.message),
        Future.chainFirstIOEitherK(
          Maybe.fold(
            () =>
              LogUtils.pretty(logger, guild).warn(
                `Couldn't fetch message ${MessageId.unwrap(poll.message)}`,
              ),
            () => IO.unit,
          ),
        ),
        futureMaybe.chainFuture(message =>
          DiscordConnector.messageEdit(
            message,
            pollMessage(
              poll.createdBy,
              poll.question,
              pipe(poll.choices, NonEmptyArray.map(ChoiceWithVotesCount.fromChoiceWithResponses)),
            ),
          ),
        ),
      )
  }

  // onMessageContextMenu
  function onMessageContextMenu(interaction: MessageContextMenuInteraction): Future<void> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.chain(() => removePoll(interaction)),
      Future.map(Maybe.getOrElse(() => 'Erreur')),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toUnit),
    )
  }

  function removePoll(interaction: MessageContextMenuInteraction): Future<Maybe<string>> {
    const messageId = MessageId.wrap(interaction.targetMessage.id)
    return pipe(
      pollService.lookupQuestionByMessage(messageId),
      Future.chain(
        Maybe.fold(
          () => futureMaybe.some("Haha ! Ce n'est pas un sondage..."),
          ({ createdBy }) =>
            canRemovePoll(interaction.user, createdBy)
              ? pipe(
                  futureMaybe.fromNullable(interaction.guild),
                  futureMaybe.chain(guild => DiscordConnector.fetchMessage(guild, messageId)),
                  futureMaybe.chainFuture(message => DiscordConnector.messageDelete(message)),
                  futureMaybe.chainOption(success =>
                    success ? Maybe.some('Sondage supprimé') : Maybe.none,
                  ),
                )
              : futureMaybe.some("Haha ! Tu n'est pas l'auteur de ce sondage..."),
        ),
      ),
    )
  }

  function canRemovePoll(user: User, pollCreatedBy: UserId): boolean {
    const userId = UserId.wrap(user.id)
    return userId === pollCreatedBy || pipe(admins, List.elem(UserId.Eq)(userId))
  }

  // onMessageDelete
  function onMessageDelete(messages: List<Message | PartialMessage>): Future<void> {
    return pipe(
      messages,
      List.filterMap(m =>
        m.guild !== null && m.author?.id === clientId
          ? Maybe.some(MessageId.wrap(m.id))
          : Maybe.none,
      ),
      NonEmptyArray.fromReadonlyArray,
      Maybe.fold(
        () => Future.unit,
        toRemove =>
          pipe(
            pollService.removePollForMessages(toRemove),
            Future.chainIOEitherK(({ removedQuestions, removedResponses }) => {
              if (removedQuestions === 0) return IO.unit
              if (removedQuestions === toRemove.length) {
                return logger.info(
                  `Removed polls: ${removedQuestions} questions, ${removedResponses} responses`,
                )
              }
              return logger.warn('Failed to remove poll')
            }),
          ),
      ),
    )
  }
}

const getChoices = (interaction: CommandInteraction): NonEmptyArray<string> =>
  pipe(
    Keys.choices,
    List.filterMap(choice => pipe(interaction.options.getString(choice), Maybe.fromNullable)),
    NonEmptyArray.fromReadonlyArray,
    Maybe.getOrElse((): NonEmptyArray<string> => ['Oui', 'Non']),
  )

const nonEmptyArrayModifyAt =
  <A>(i: number, f: (a: A) => A) =>
  (fa: NonEmptyArray<A>): NonEmptyArray<A> =>
    pipe(
      fa,
      NonEmptyArray.modifyAt(i, f),
      Maybe.getOrElse(() => fa),
    )
