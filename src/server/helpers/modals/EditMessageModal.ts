import type { Message, ModalSubmitInteraction } from 'discord.js'
import { TextInputStyle } from 'discord.js'
import { apply } from 'fp-ts'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'

import type { LoggerType } from '../../../shared/models/LoggerType'
import { createUnion } from '../../../shared/utils/createUnion'
import type { Dict } from '../../../shared/utils/fp'
import { Either, IO, Maybe } from '../../../shared/utils/fp'

import { MessageId } from '../../models/MessageId'
import { Modal } from '../../models/discord/Modal'
import { InteractionUtils } from '../../utils/InteractionUtils'
import { CustomId } from '../../utils/ioTsUtils'
import { AutoroleMessage } from '../messages/AutoroleMessage'

type EditMessageModal = typeof u.T

type EditMessageModalAutorole = typeof u.Autorole.T
type EditMessageModalDefault = typeof u.Default.T

type AutoroleArgs = {
  readonly messageId: MessageId
} & Omit<AutoroleMessage, 'roleId'>

type DefaultArgs = {
  readonly messageId: MessageId
  readonly content: string
}

const u = createUnion({
  Autorole: (args: AutoroleArgs) => args,
  Default: (args: DefaultArgs) => args,
})

/**
 * Autorole
 */

type AutoroleDict = Dict<keyof Omit<AutoroleArgs, 'messageId'>, string>

const autoroleModalId = pipe(CustomId.codec('editMessageModalAutorole'), C.compose(MessageId.codec))

const autoroleTextInputIds: AutoroleDict = {
  descriptionMessage: 'editMessageModalContent',
  addButton: 'editMessageModalAddButton',
  removeButton: 'editMessageModalRemoveButton',
  addButtonEmoji: 'editMessageModalAddButtonEmoji',
  removeButtonEmoji: 'editMessageModalRemoveButtonEmoji',
}

const autoroleLabels: AutoroleDict = {
  descriptionMessage: "Message d'autorole",
  addButton: 'Bouton ajouter',
  removeButton: 'Bouton enlever',
  addButtonEmoji: 'Émoji bouton ajouter',
  removeButtonEmoji: 'Émoji bouton enlever',
}

const EditMessageModalAutorole = {
  Labels: autoroleLabels,

  toModal: (m: EditMessageModalAutorole): Modal =>
    Modal.of({
      custom_id: autoroleModalId.encode(m.messageId),
      title: 'Edit autorole message',
    })([
      Modal.textInput({
        custom_id: autoroleTextInputIds.descriptionMessage,
        style: TextInputStyle.Paragraph,
        label: autoroleLabels.descriptionMessage,
        value: m.descriptionMessage,
        max_length: 4000,
      }),
      Modal.textInput({
        custom_id: autoroleTextInputIds.addButton,
        style: TextInputStyle.Short,
        label: autoroleLabels.addButton,
        value: m.addButton,
      }),
      Modal.textInput({
        custom_id: autoroleTextInputIds.removeButton,
        style: TextInputStyle.Short,
        label: autoroleLabels.removeButton,
        value: m.removeButton,
      }),
      Modal.textInput({
        custom_id: autoroleTextInputIds.addButtonEmoji,
        style: TextInputStyle.Short,
        label: autoroleLabels.addButtonEmoji,
        value: Maybe.toUndefined(m.addButtonEmoji),
        required: false,
      }),
      Modal.textInput({
        custom_id: autoroleTextInputIds.removeButtonEmoji,
        style: TextInputStyle.Short,
        label: autoroleLabels.removeButtonEmoji,
        value: Maybe.toUndefined(m.removeButtonEmoji),
        required: false,
      }),
    ]),

  fromInteraction: (interaction: ModalSubmitInteraction): Maybe<EditMessageModalAutorole> => {
    const i = InteractionUtils.validateModal(interaction)
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        messageId: Maybe.fromEither(autoroleModalId.decode(interaction.customId)),
        descriptionMessage: i.getValue(autoroleTextInputIds.descriptionMessage),
        addButton: i.getValue(autoroleTextInputIds.addButton),
        removeButton: i.getValue(autoroleTextInputIds.removeButton),
        addButtonEmoji: i.getValueOpt(autoroleTextInputIds.addButtonEmoji),
        removeButtonEmoji: i.getValueOpt(autoroleTextInputIds.removeButtonEmoji),
      }),
      Maybe.map(u.Autorole),
    )
  },
}

/**
 * Default
 */

type DefaultDict = Dict<keyof Omit<DefaultArgs, 'messageId'>, string>

const defaultModalId = pipe(CustomId.codec('editMessageModalDefault'), C.compose(MessageId.codec))

const defaultTextInputIds: DefaultDict = {
  content: 'editMessageModalContent',
}

const EditMessageModalDefault = {
  toModal: (m: EditMessageModalDefault): Modal =>
    Modal.of({
      custom_id: defaultModalId.encode(m.messageId),
      title: 'Edit message',
    })([
      Modal.textInput({
        custom_id: defaultTextInputIds.content,
        style: TextInputStyle.Paragraph,
        label: 'Content',
        value: m.content,
      }),
    ]),

  fromInteraction: (interaction: ModalSubmitInteraction): Maybe<EditMessageModalDefault> => {
    const i = InteractionUtils.validateModal(interaction)
    return pipe(
      apply.sequenceS(Maybe.Apply)({
        messageId: Maybe.fromEither(autoroleModalId.decode(interaction.customId)),
        content: i.getValue(defaultTextInputIds.content),
      }),
      Maybe.map(u.Default),
    )
  },
}

/**
 * EditMessageModal
 */

type FoldArgs<A, B = A> = {
  readonly onAutorole: (autorole: EditMessageModalAutorole) => A
  readonly onDefault: (default_: EditMessageModalDefault) => B
}

const fold =
  <A, B>({ onAutorole, onDefault }: FoldArgs<A, B>) =>
  (modal: EditMessageModal): A | B => {
    switch (modal.type) {
      case 'Autorole':
        return onAutorole(modal)
      case 'Default':
        return onDefault(modal)
    }
  }

const EditMessageModal = {
  fold,

  fromMessage:
    (logger: LoggerType) =>
    (message: Message): IO<Modal> =>
      pipe(
        AutoroleMessage.messageDecoder.decode(message),
        Either.fold(
          e =>
            pipe(
              logger.debug(`Couldn't decode AutoroleMessage:\n${D.draw(e)}`),
              IO.map(() =>
                EditMessageModalDefault.toModal(
                  u.Default({
                    messageId: MessageId.fromMessage(message),
                    content: message.content,
                  }),
                ),
              ),
            ),
          ({ descriptionMessage, addButton, removeButton, addButtonEmoji, removeButtonEmoji }) =>
            IO.right(
              EditMessageModalAutorole.toModal(
                u.Autorole({
                  messageId: MessageId.fromMessage(message),
                  descriptionMessage,
                  addButton,
                  removeButton,
                  addButtonEmoji,
                  removeButtonEmoji,
                }),
              ),
            ),
        ),
      ),

  fromInteraction: (interaction: ModalSubmitInteraction): Maybe<EditMessageModal> =>
    pipe(
      EditMessageModalAutorole.fromInteraction(interaction),
      Maybe.altW(() => EditMessageModalDefault.fromInteraction(interaction)),
    ),
}

export { EditMessageModal, EditMessageModalAutorole, EditMessageModalDefault }
