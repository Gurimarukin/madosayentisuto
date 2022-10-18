import type {
  APIMessage,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Guild,
  Interaction,
  MessageContextMenuCommandInteraction,
  PartialMessage,
  ThreadChannel,
  User,
} from 'discord.js'
import { Message, ThreadAutoArchiveDuration } from 'discord.js'
import { apply } from 'fp-ts'
import { flow, pipe } from 'fp-ts/function'
import { lens } from 'monocle-ts'

import { ChannelId } from '../../../shared/models/ChannelId'
import { DiscordUserId } from '../../../shared/models/DiscordUserId'
import type { NotUsed } from '../../../shared/models/NotUsed'
import { ObserverWithRefinement } from '../../../shared/models/rx/ObserverWithRefinement'
import { Future, IO, List, Maybe, NonEmptyArray, Tuple, toNotUsed } from '../../../shared/utils/fp'
import { futureMaybe } from '../../../shared/utils/futureMaybe'

import type { Config } from '../../config/Config'
import { DiscordConnector } from '../../helpers/DiscordConnector'
import { PollMessage } from '../../helpers/messages/PollMessage'
import { MessageId } from '../../models/MessageId'
import { Command } from '../../models/discord/Command'
import { MadEvent } from '../../models/event/MadEvent'
import type { LoggerGetter } from '../../models/logger/LoggerObservable'
import { ChoiceWithResponses } from '../../models/poll/ChoiceWithResponses'
import { ChoiceWithVotesCount } from '../../models/poll/ChoiceWithVotesCount'
import { Poll } from '../../models/poll/Poll'
import { PollButton } from '../../models/poll/PollButton'
import { PollResponse } from '../../models/poll/PollResponse'
import type { ThreadWithMessage } from '../../models/poll/ThreadWithMessage'
import type { PollService } from '../../services/PollService'
import { ChannelUtils } from '../../utils/ChannelUtils'
import { LogUtils } from '../../utils/LogUtils'

const keysChoices = pipe(
  NonEmptyArray.range(1, 5),
  NonEmptyArray.map(i => Tuple.of(`choix_${i}`, `Choix ${i}`)),
)

const Keys = {
  poll: 'sondage',
  question: 'question',
  choices: pipe(keysChoices, NonEmptyArray.map(Tuple.fst)),
  anonymous: 'anonyme',
  multiple: 'multiple',
  deletePoll: 'Supprimer sondage',
}

const threadName = 'Détail du sondage'

const pollCommand = Command.chatInput({
  name: Keys.poll,
  description: 'Jean Plank fait des sondages',
})(
  Command.option.string({
    name: Keys.question,
    description: 'La question du sondage',
    required: true,
  }),
  ...pipe(
    keysChoices,
    List.map(([name, description]) => Command.option.string({ name, description })),
  ),
  Command.option.boolean({
    name: Keys.anonymous,
    description: 'Visibilité du sondage (visible par défaut)',
  }),
  Command.option.boolean({
    name: Keys.multiple,
    description: 'Une seule ou plusieurs réponses par votant (une seule par défaut)',
  }),
)

const messageDeleteCommand = Command.message({ name: Keys.deletePoll })

export const pollCommands = [pollCommand, messageDeleteCommand]

type IsMultiple = {
  readonly isMultiple: boolean
}

type IsAnonymous = {
  readonly isAnonymous: boolean
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const PollCommandsObserver = (
  Logger: LoggerGetter,
  config: Config,
  discord: DiscordConnector,
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
  function onInteraction(interaction: Interaction): Future<NotUsed> {
    if (interaction.isChatInputCommand()) return onChatInputCommand(interaction)
    if (interaction.isButton()) return onButton(interaction)
    if (interaction.isMessageContextMenuCommand()) return onMessageContextMenu(interaction)
    return Future.notUsed
  }

  // onChatInputCommand
  function onChatInputCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    switch (interaction.commandName) {
      case Keys.poll:
        return onPollCommand(interaction)
    }
    return Future.notUsed
  }

  // onPollCommand
  function onPollCommand(interaction: ChatInputCommandInteraction): Future<NotUsed> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: false }),
      Future.map(() => Maybe.fromNullable(interaction.options.getString(Keys.question))),
      futureMaybe.chainTaskEitherK(question =>
        initPoll(interaction, interaction.user, question, getChoices(interaction), {
          isAnonymous: interaction.options.getBoolean(Keys.anonymous) ?? false,
          isMultiple: interaction.options.getBoolean(Keys.multiple) ?? false,
        }),
      ),
      Future.map(toNotUsed),
    )
  }

  function initPoll(
    interaction: ChatInputCommandInteraction,
    user: User,
    question: string,
    choices: NonEmptyArray<string>,
    { isAnonymous, isMultiple }: IsAnonymous & IsMultiple,
  ): Future<NotUsed> {
    const guild = interaction.guild
    if (guild === null) return Future.notUsed

    const options = PollMessage.poll(
      question,
      pipe(choices, NonEmptyArray.map(ChoiceWithVotesCount.empty)),
      { isAnonymous, isMultiple },
    )
    return pipe(
      DiscordConnector.interactionFollowUp(interaction, options),
      Future.chain(message =>
        message instanceof Message
          ? futureMaybe.some(message)
          : DiscordConnector.fetchMessage(guild, MessageId.fromMessage(message)),
      ),
      futureMaybe.chainTaskEitherK(message =>
        apply.sequenceS(Future.ApplyPar)({
          // we want the `(edited)` label on message so we won't have a layout shift
          message: DiscordConnector.messageEdit(message, options),
          detail: isAnonymous
            ? futureMaybe.none
            : initDetailMessage(
                pipe(choices, NonEmptyArray.map(ChoiceWithResponses.empty)),
                message,
              ),
        }),
      ),
      futureMaybe.chainTaskEitherK(({ message, detail }) =>
        pollService.createPoll({
          message: MessageId.fromMessage(message),
          createdBy: DiscordUserId.fromUser(user),
          question,
          choices,
          detail,
          isMultiple,
          isAnonymous,
        }),
      ),
      futureMaybe.matchE(
        () => Future.notUsed,
        success =>
          success ? Future.notUsed : Future.fromIOEither(logger.warn('Failed to create poll')),
      ),
    )
  }

  // onButton
  function onButton(interaction: ButtonInteraction): Future<NotUsed> {
    return pipe(
      PollButton.parse(interaction.customId),
      Maybe.fold(
        () => Future.notUsed,
        button =>
          pipe(
            DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
            Future.chain(() => futureMaybe.fromNullable(interaction.guild)),
            futureMaybe.chain(guild =>
              castVote(guild, interaction.message, interaction.user, button),
            ),
            Future.map(Maybe.getOrElse(() => 'Erreur')),
            Future.chain(content =>
              DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
            ),
            Future.map(toNotUsed),
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
    const messageId = MessageId.fromMessage(message)
    const userId = DiscordUserId.fromUser(user)
    return pipe(
      pollService.lookupPollByMessage(messageId),
      futureMaybe.chain(poll =>
        pipe(
          poll.choices,
          List.lookup(choiceIndex),
          Maybe.fold(
            () => futureMaybe.none,
            choice => {
              const alreadyVotedForChoice = pipe(
                choice.responses,
                List.elem(DiscordUserId.Eq)(userId),
              )
              if (alreadyVotedForChoice) {
                return pipe(
                  removeResponse(poll, userId, choiceIndex),
                  Future.map(p => Maybe.some(Tuple.of(p, 'Vote supprimé'))),
                )
              }
              return pipe(
                poll.isMultiple
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
      futureMaybe.chainFirstTaskEitherK(flow(Tuple.fst, refreshMessages(guild))),
      Future.map(Maybe.map(Tuple.snd)),
    )
  }

  function removeResponsesForUser(poll: Poll, user: DiscordUserId): Future<Poll> {
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
        count === toRemove ? IO.notUsed : logger.warn('Weird responses deletion count'),
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

  function addResponse(user: DiscordUserId, choiceIndex: number): (poll: Poll) => Future<Poll> {
    return poll =>
      pipe(
        pollService.createResponse(PollResponse.of(poll.message, user, choiceIndex)),
        Future.chainIOEitherK(success =>
          success ? IO.notUsed : logger.warn('Failed to add response'),
        ),
        Future.map(() =>
          pipe(
            Poll.Lens.choices,
            lens.modify(
              nonEmptyArrayModifyAt(
                choiceIndex,
                pipe(
                  ChoiceWithResponses.Lens.responses,
                  lens.modify<List<DiscordUserId>>(List.append(user)),
                ),
              ),
            ),
          )(poll),
        ),
      )
  }

  function removeResponse(poll: Poll, user: DiscordUserId, choiceIndex: number): Future<Poll> {
    return pipe(
      pollService.removeResponse(PollResponse.of(poll.message, user, choiceIndex)),
      Future.chainIOEitherK(success =>
        success ? IO.notUsed : logger.warn('Failed to remove response'),
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

  function refreshMessages(guild: Guild): (poll: Poll) => Future<NotUsed> {
    return poll =>
      pipe(
        apply.sequenceT(Future.ApplyPar)(
          refreshPollMessage(guild, poll),
          refreshDetailMessage(guild, poll),
        ),
        Future.map(toNotUsed),
      )
  }

  function refreshPollMessage(guild: Guild, poll: Poll): Future<Maybe<Message>> {
    return pipe(
      DiscordConnector.fetchMessage(guild, poll.message),
      Future.chainFirstIOEitherK(
        Maybe.fold(
          () =>
            LogUtils.pretty(logger, guild).warn(
              `Couldn't fetch poll message ${MessageId.unwrap(poll.message)}`,
            ),
          () => IO.notUsed,
        ),
      ),
      futureMaybe.chainTaskEitherK(message =>
        DiscordConnector.messageEdit(
          message,
          PollMessage.poll(
            poll.question,
            pipe(poll.choices, NonEmptyArray.map(ChoiceWithVotesCount.fromChoiceWithResponses)),
            { isAnonymous: poll.isAnonymous, isMultiple: poll.isMultiple },
          ),
        ),
      ),
    )
  }

  function refreshDetailMessage(guild: Guild, poll: Poll): Future<NotUsed> {
    if (poll.isAnonymous) return Future.notUsed

    return pipe(
      futureMaybe.fromOption(poll.detail),
      futureMaybe.chainTaskEitherK(detail =>
        pipe(
          DiscordConnector.fetchMessage(guild, detail.message),
          Future.chain(
            Maybe.fold(
              // maybe the thread got deleted?
              () => pipe(getThread(detail.thread), Future.chain(reInitDetailMessage(guild, poll))),
              message => editDetailMessage(message, poll, detail.thread),
            ),
          ),
        ),
      ),
      Future.map(toNotUsed),
    )
  }

  function getThread(thread: ChannelId): Future<Maybe<ThreadChannel>> {
    return pipe(discord.fetchChannel(thread), futureMaybe.filter(ChannelUtils.isThread))
  }

  function reInitDetailMessage(
    guild: Guild,
    poll: Poll,
  ): (thread: Maybe<ThreadChannel>) => Future<NotUsed> {
    return maybeThread =>
      pipe(
        DiscordConnector.fetchMessage(guild, poll.message),
        futureMaybe.chain(pollMessage =>
          pipe(
            maybeThread,
            Maybe.fold(
              () => initDetailMessage(poll.choices, pollMessage),
              // the tread still exist, don't recreate it
              thread => initDetailMessageFromThread(poll.choices, thread),
            ),
          ),
        ),
        futureMaybe.chainTaskEitherK(detail => pollService.setPollDetail(poll.message, detail)),
        Future.map(toNotUsed),
      )
  }

  function initDetailMessage(
    choices: NonEmptyArray<ChoiceWithResponses>,
    pollMessage: Message,
  ): Future<Maybe<ThreadWithMessage>> {
    return pipe(
      DiscordConnector.messageStartThread(pollMessage, {
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      }),
      Future.chain(thread => initDetailMessageFromThread(choices, thread)),
    )
  }

  function initDetailMessageFromThread(
    choices: NonEmptyArray<ChoiceWithResponses>,
    thread: ThreadChannel,
  ): Future<Maybe<ThreadWithMessage>> {
    const options = PollMessage.detail(choices)
    return pipe(
      DiscordConnector.sendMessage(thread, options),
      futureMaybe.chainFirstTaskEitherK(message =>
        // we want the `(edited)` label on message so we won't have a layout shift
        DiscordConnector.messageEdit(message, options),
      ),
      futureMaybe.map(
        (message): ThreadWithMessage => ({
          thread: ChannelId.fromChannel(thread),
          message: MessageId.fromMessage(message),
        }),
      ),
    )
  }

  function editDetailMessage(message: Message, poll: Poll, threadId: ChannelId): Future<NotUsed> {
    const messageEdit = DiscordConnector.messageEdit(message, PollMessage.detail(poll.choices))
    return pipe(
      messageEdit,
      Future.map(toNotUsed),
      Future.orElse(e =>
        e.message.split('\n')[1] === 'DiscordAPIError: Thread is archived'
          ? pipe(
              getThread(threadId),
              futureMaybe.chainTaskEitherK(thread =>
                DiscordConnector.threadSetArchived(thread, false),
              ),
              futureMaybe.chainTaskEitherK(() => messageEdit),
              Future.map(toNotUsed),
            )
          : Future.left(e),
      ),
    )
  }

  // onMessageContextMenu
  function onMessageContextMenu(
    interaction: MessageContextMenuCommandInteraction,
  ): Future<NotUsed> {
    return pipe(
      DiscordConnector.interactionDeferReply(interaction, { ephemeral: true }),
      Future.chain(() => removePollIfAllowed(interaction)),
      Future.map(Maybe.getOrElse(() => 'Erreur')),
      Future.chain(content =>
        DiscordConnector.interactionFollowUp(interaction, { content, ephemeral: true }),
      ),
      Future.map(toNotUsed),
    )
  }

  function removePollIfAllowed(
    interaction: MessageContextMenuCommandInteraction,
  ): Future<Maybe<string>> {
    const messageId = MessageId.fromMessage(interaction.targetMessage)
    return pipe(
      pollService.lookupQuestionByMessage(messageId),
      Future.chain(
        Maybe.fold(
          () => futureMaybe.some("Haha ! Ce n'est pas un sondage..."),
          ({ createdBy, detail }) =>
            canRemovePoll(interaction.user, createdBy)
              ? removePoll(
                  interaction.guild,
                  messageId,
                  pipe(
                    detail,
                    Maybe.map(d => d.thread),
                  ),
                )
              : futureMaybe.some("Haha ! Tu n'est pas l'auteur de ce sondage..."),
        ),
      ),
    )
  }

  function canRemovePoll(user: User, pollCreatedBy: DiscordUserId): boolean {
    const userId = DiscordUserId.fromUser(user)
    return userId === pollCreatedBy || pipe(config.admins, List.elem(DiscordUserId.Eq)(userId))
  }

  function removePoll(
    maybeGuild: Guild | null,
    pollMessage: MessageId,
    thread: Maybe<ChannelId>,
  ): Future<Maybe<string>> {
    return pipe(
      futureMaybe.fromNullable(maybeGuild),
      futureMaybe.chainTaskEitherK(guild =>
        apply.sequenceT(Future.ApplyPar)(
          removePollMessage(guild, pollMessage),
          removeThread(guild, thread),
        ),
      ),
      futureMaybe.chainOption(Tuple.fst),
    )
  }

  function removePollMessage(guild: Guild, pollMessage: MessageId): Future<Maybe<string>> {
    return pipe(
      DiscordConnector.fetchMessage(guild, pollMessage),
      futureMaybe.chainTaskEitherK(message => DiscordConnector.messageDelete(message)),
      futureMaybe.chainOption(success => (success ? Maybe.some('Sondage supprimé') : Maybe.none)),
    )
  }

  function removeThread(guild: Guild, maybeThread: Maybe<ChannelId>): Future<NotUsed> {
    return pipe(
      maybeThread,
      Maybe.fold(
        () => Future.notUsed,
        threadId =>
          pipe(
            discord.fetchChannel(threadId),
            futureMaybe.filter(ChannelUtils.isThread),
            futureMaybe.chainTaskEitherK(DiscordConnector.threadDelete),
            Future.map(Maybe.getOrElse(() => false)),
            Future.chainIOEitherK(success =>
              success
                ? IO.notUsed
                : LogUtils.pretty(logger, guild).info(
                    `Couldn't delete poll thread ${ChannelId.unwrap(threadId)}`,
                  ),
            ),
          ),
      ),
    )
  }

  // onMessageDelete
  function onMessageDelete(messages: List<Message | PartialMessage>): Future<NotUsed> {
    return pipe(
      messages,
      List.filterMap(m =>
        m.guild !== null &&
        m.author !== null &&
        DiscordUserId.fromUser(m.author) === config.client.id
          ? Maybe.some(MessageId.fromMessage(m))
          : Maybe.none,
      ),
      NonEmptyArray.fromReadonlyArray,
      Maybe.fold(
        () => Future.notUsed,
        toRemove =>
          pipe(
            pollService.removePollForMessages(toRemove),
            Future.chainIOEitherK(({ removedQuestions, removedResponses }) => {
              if (removedQuestions === 0) return IO.notUsed
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

const getChoices = (interaction: ChatInputCommandInteraction): NonEmptyArray<string> =>
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
