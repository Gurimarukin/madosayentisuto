import type { Message } from 'discord.js'
import { TextInputStyle } from 'discord.js'
import { flow, pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'
import * as D from 'io-ts/Decoder'

import type { LoggerType } from '../../../shared/models/LoggerType'
import { Either, IO, Maybe } from '../../../shared/utils/fp'

import { MessageId } from '../../models/MessageId'
import { Modal } from '../../models/discord/Modal'
import { CustomId } from '../../utils/ioTsUtils'
import { AutoroleMessage } from '../messages/AutoroleMessage'

const Ids = {
  Modals: {
    autorole: pipe(CustomId.codec('editMessageModalAutorole'), C.compose(MessageId.codec)),
    default: pipe(CustomId.codec('editMessageModalDefault'), C.compose(MessageId.codec)),
  },

  TextInputs: {
    content: 'editMessageModalContent',
    addButton: 'editMessageModalAddButton',
    removeButton: 'editMessageModalRemoveButton',
    addButtonEmoji: 'editMessageModalAddButtonEmoji',
    removeButtonEmoji: 'editMessageModalRemoveButtonEmoji',
  },
}

const editAutoroleMessageModal =
  (messageId: MessageId) =>
  ({
    descriptionMessage,
    addButton,
    removeButton,
    addButtonEmoji,
    removeButtonEmoji,
  }: AutoroleMessage): Modal =>
    Modal.of({
      custom_id: Ids.Modals.autorole.encode(messageId),
      title: 'Edit autorole message',
    })([
      Modal.textInput({
        custom_id: Ids.TextInputs.content,
        style: TextInputStyle.Paragraph,
        label: 'Content',
        value: descriptionMessage,
      }),
      Modal.textInput({
        custom_id: Ids.TextInputs.addButton,
        style: TextInputStyle.Short,
        label: 'Add button',
        value: addButton,
      }),
      Modal.textInput({
        custom_id: Ids.TextInputs.removeButton,
        style: TextInputStyle.Short,
        label: 'Remove button',
        value: removeButton,
      }),
      Modal.textInput({
        custom_id: Ids.TextInputs.addButtonEmoji,
        style: TextInputStyle.Short,
        label: 'Add button emoji',
        value: Maybe.toUndefined(addButtonEmoji),
        required: false,
      }),
      Modal.textInput({
        custom_id: Ids.TextInputs.removeButtonEmoji,
        style: TextInputStyle.Short,
        label: 'Remove button emoji',
        value: Maybe.toUndefined(removeButtonEmoji),
        required: false,
      }),
    ])

const editDefaultMessageModal = (message: Message): Modal =>
  Modal.of({
    custom_id: Ids.Modals.default.encode(MessageId.fromMessage(message)),
    title: 'Edit message',
  })([
    Modal.textInput({
      custom_id: Ids.TextInputs.content,
      style: TextInputStyle.Short,
      label: 'Content',
      value: message.content,
    }),
  ])

const fromMessage =
  (logger: LoggerType) =>
  (message: Message): IO<Modal> =>
    pipe(
      AutoroleMessage.messageDecoder.decode(message),
      Either.fold(
        e =>
          pipe(
            logger.debug(`Couldn't decode AutoroleMessage:\n${D.draw(e)}`),
            IO.map(() => editDefaultMessageModal(message)),
          ),
        flow(editAutoroleMessageModal(MessageId.fromMessage(message)), IO.right),
      ),
    )

export const EditMessageModal = { fromMessage }
