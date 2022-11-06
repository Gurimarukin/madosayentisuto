import type { Message, ModalSubmitInteraction } from 'discord.js'
import { TextInputStyle } from 'discord.js'
import { pipe } from 'fp-ts/function'
import * as C from 'io-ts/Codec'

import { Maybe } from '../../../shared/utils/fp'

import { MessageId } from '../../models/MessageId'
import { Modal } from '../../models/discord/Modal'
import { CustomId } from '../../utils/ioTsUtils'

type DeleteMessageModal = {
  readonly messageId: MessageId
}

const id = pipe(CustomId.codec('deleteMessageModal'), C.compose(MessageId.codec))

const deleteMessage = 'Delete message?'

const DeleteMessageModal = {
  fromMessage: (message: Message): Modal =>
    Modal.of({
      custom_id: id.encode(MessageId.fromMessage(message)),
      title: deleteMessage,
    })([
      Modal.textInput({
        custom_id: 'whatever',
        style: TextInputStyle.Short,
        label: deleteMessage,
        placeholder: 'Useless input',
        required: false,
      }),
    ]),

  fromInteraction: (interaction: ModalSubmitInteraction): Maybe<DeleteMessageModal> =>
    pipe(
      id.decode(interaction.customId),
      Maybe.fromEither,
      Maybe.map(messageId => ({ messageId })),
    ),
}

export { DeleteMessageModal }
